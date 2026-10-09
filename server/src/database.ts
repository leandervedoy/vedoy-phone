import { db } from './clients.js';

type Row = Record<string, any>;
type Result = { data: any; error: any; count?: number | null };
const tables = new Set(['phone_numbers','messages','call_events','kyc_submissions','sms_opt_outs']);
const jsonColumns = new Set(['capabilities','documents']);
const safeIdentifier = (value: string) => {
  if (/^[a-z_][a-z0-9_]*$/i.test(value)) return `"${value}"`;
  const json = /^([a-z_][a-z0-9_]*)->>([a-z_][a-z0-9_]*)$/i.exec(value);
  if (json) return `"${json[1]}"->>'${json[2]}'`;
  throw new Error('Invalid database identifier');
};
const columns = (list: string) => list.trim() === '*' ? '*' : list.split(',').map(x=>safeIdentifier(x.trim())).join(',');

class Query implements PromiseLike<Result> {
  private action: 'select'|'insert'|'update'|'upsert' = 'select';
  private projection = '*'; private values: Row = {}; private filters: string[] = []; private params: unknown[] = [];
  private sort = ''; private rowLimit?: number; private singleMode: 'single'|'maybe'|null = null;
  private conflict?: string; private returnRows = false; private countMode = false; private head = false;
  constructor(private table: string) { if(!tables.has(table)) throw new Error('Unknown phone data table'); }
  select(fields='*',opts?:{count?:string;head?:boolean}) { this.projection=fields; if(this.action!=='select')this.returnRows=true; this.countMode=opts?.count==='exact';this.head=!!opts?.head; return this; }
  insert(row:Row){this.action='insert';this.values=row;return this;}
  update(row:Row){this.action='update';this.values=row;return this;}
  upsert(row:Row,opts?:{onConflict?:string}){this.action='upsert';this.values=row;this.conflict=opts?.onConflict;this.returnRows=true;return this;}
  eq(key:string,value:unknown){this.filters.push(`${safeIdentifier(key)}::text = ${this.bind(value)}`);return this;}
  gte(key:string,value:unknown){this.filters.push(`${safeIdentifier(key)} >= ${this.bind(value)}`);return this;}
  in(key:string,values:unknown[]){this.filters.push(`${safeIdentifier(key)}::text = ANY(${this.bind(values.map(String))}::text[])`);return this;}
  order(key:string,opts?:{ascending?:boolean}){this.sort=` ORDER BY ${safeIdentifier(key)} ${opts?.ascending===false?'DESC':'ASC'}`;return this;}
  limit(n:number){this.rowLimit=Math.max(0,Math.min(1000,n));return this;}
  or(expression:string){
    const m=/and\(from_number\.eq\.([^,]+),to_number\.eq\.([^,]+),direction\.eq\.(inbound|outbound)\),and\(from_number\.eq\.([^,]+),to_number\.eq\.([^,]+),direction\.eq\.(inbound|outbound)\)/.exec(expression);
    if(!m)throw new Error('Unsupported database filter');
    this.filters.push(`(from_number=${this.bind(m[1])} AND to_number=${this.bind(m[2])} AND direction=${this.bind(m[3])}) OR (from_number=${this.bind(m[4])} AND to_number=${this.bind(m[5])} AND direction=${this.bind(m[6])})`);return this;
  }
  single(){this.singleMode='single';return this.execute();}
  maybeSingle(){this.singleMode='maybe';return this.execute();}
  private bind(value:unknown){this.params.push(value);return `$${this.params.length}`;}
  private where(){return this.filters.length?` WHERE ${this.filters.map(x=>`(${x})`).join(' AND ')}`:'';}
  private async execute():Promise<Result>{
    try {
      const table=`"${this.table}"`;
      if(this.action==='select'){
        const where=this.where();
        let count:number|null=null;
        if(this.countMode){const c=await db.query(`SELECT count(*)::int AS n FROM ${table}${where}`,this.params);count=c.rows[0]?.n??0;}
        if(this.head)return {data:null,error:null,count};
        let sql=`SELECT ${columns(this.projection)} FROM ${table}${where}${this.sort}`;
        const p=[...this.params];if(this.rowLimit!==undefined)sql+=` LIMIT ${this.bind(this.rowLimit)}`;
        const result=await db.query(sql,p);
        if(this.singleMode==='single'&&result.rows.length!==1)return {data:null,error:new Error(result.rows.length?'Expected one row':'Row not found')};
        return {data:this.singleMode?result.rows[0]??null:result.rows,error:null,...(this.countMode?{count}: {})};
      }
      const keys=Object.keys(this.values);if(!keys.length)throw new Error('Empty write');
      const vals=keys.map(k=>this.values[k]);const refs=keys.map((k,i)=>`${safeIdentifier(k)}${jsonColumns.has(k)?'::jsonb':''}`);
      const pvals=vals.map((v,i)=>jsonColumns.has(keys[i]!)?JSON.stringify(v):v);
      const assignments=keys.map((k,i)=>`${safeIdentifier(k)}=EXCLUDED.${safeIdentifier(k)}`);
      let sql:string;
      if(this.action==='insert'||this.action==='upsert'){
        sql=`INSERT INTO ${table} (${keys.map(safeIdentifier).join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}${jsonColumns.has(keys[i]! )?'::jsonb':''}`).join(',')})`;
        if(this.action==='upsert')sql+=` ON CONFLICT (${(this.conflict??'').split(',').map(x=>safeIdentifier(x.trim())).join(',')}) DO UPDATE SET ${assignments.join(',')}`;
        if(this.returnRows)sql+=` RETURNING ${columns(this.projection)}`;
      }else{
        this.params=[];const set=keys.map((k,i)=>`${safeIdentifier(k)}=$${i+1}${jsonColumns.has(k)?'::jsonb':''}`).join(',');this.params=pvals;
        sql=`UPDATE ${table} SET ${set}${this.where()}${this.returnRows?` RETURNING ${columns(this.projection)}`:''}`;
      }
      const result=await db.query(sql,this.action==='update'?this.params:pvals);
      return {data:this.returnRows?(this.singleMode?result.rows[0]??null:result.rows):null,error:null};
    } catch(error) { return {data:null,error}; }
  }
  then<TResult1=Result,TResult2=never>(onfulfilled?:((value:Result)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{return this.execute().then(onfulfilled,onrejected);}
}

export const phoneDb={from:(table:string)=>new Query(table),rpc:async(name:string,args:Row):Promise<Result>=>{
  if(name!=='reserve_phone_number')return {data:null,error:new Error('Unknown database operation')};
  const client=await db.connect();
  try { await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[args.p_user_id]);
    const lock=await client.query("SELECT count(*)::int AS total FROM phone_numbers WHERE user_id=$1 AND status IN ('active','pending')",[args.p_user_id]);
    if(lock.rows[0].total>=args.p_max)throw new Error(`number_limit: Kontogrensen er ${args.p_max} aktive numre.`);
    const ins=await client.query(`INSERT INTO phone_numbers(user_id,phone_number,country_code,number_type,capabilities,status) VALUES($1,$2,$3,$4,$5::jsonb,'pending') RETURNING id`,[args.p_user_id,args.p_phone_number,args.p_country_code,args.p_number_type,JSON.stringify(args.p_capabilities)]);
    await client.query('COMMIT');return {data:ins.rows[0].id,error:null};
  }catch(error){await client.query('ROLLBACK');return {data:null,error};}finally{client.release();}
}};
