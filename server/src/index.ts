import {env} from './config.js';
import {app} from './app.js';
app.listen(env.PORT,'0.0.0.0',()=>console.log(`Vedoy Connect API listening on ${env.PORT}`));
