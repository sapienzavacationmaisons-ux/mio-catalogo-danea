const express=require('express'),fs=require('fs'),path=require('path'),cors=require('cors'),app=express(),PORT=process.env.PORT||3000;
app.use(cors());
app.use(express.text({limit:'50mb',type:'text/xml'}));
app.use(express.raw({limit:'50mb',type:'application/xml'}));
app.use(express.static(__dirname));
const DATA_FILE=path.join(__dirname,'prodotti.json');
function load(){try{if(fs.existsSync(DATA_FILE))return JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}catch(e){}return{products:[],lastUpdate:null}}
function save(d){fs.writeFileSync(DATA_FILE,JSON.stringify(d,null,2))}
app.post('/api/sync',(req,res)=>{try{let x=req.body;if(typeof x==='string')x=x.replace(/^\uFEFF/,'');const prods=[],re=/<Product>([\s\S]*?)<\/Product>/gi;let m;while((m=re.exec(x))!==null){const b=m[1],c=(b.match(/<Code>([^<]*)<\/Code>/i)||[])[1]?.trim();if(!c)continue;const n=(b.match(/<Description>([^<]*)<\/Description>/i)||[])[1]?.trim()||c,cat=(b.match(/<Category>([^<]*)<\/Category>/i)||[])[1]?.trim()||'DA DANEA',sup=(b.match(/<SupplierName>([^<]*)<\/SupplierName>/i)||[])[1]?.trim()||'N/D',nt=(b.match(/<Notes>([^<]*)<\/Notes>/i)||[])[1]?.trim()||'';let pr=(b.match(/<NetPrice1>([^<]*)<\/NetPrice1>/i)||[])[1]?.trim()||'0';const num=parseFloat(pr.replace(',','.'));pr=isNaN(num)?'0,00':num.toFixed(4).replace('.',',');prods.push({code:c,name:n,category:cat,manufacturer:sup,price:pr,note:nt,source:'danea'})}const data=load();let up=0,ad=0;prods.forEach(np=>{const idx=data.products.findIndex(p=>p.code===np.code);if(idx>=0){if(data.products[idx].img)np.img=data.products[idx].img;data.products[idx]=np;up++}else{data.products.push(np);ad++}});data.lastUpdate=new Date().toISOString();save(data);res.json({success:true,updated:up,added:ad,total:prods.length})}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/catalogo',(req,res)=>{const d=load();res.json(d)});
app.listen(PORT,()=>console.log('Server su porta '+PORT));