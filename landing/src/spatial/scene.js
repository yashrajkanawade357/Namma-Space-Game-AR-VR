(()=>{
const $=s=>document.querySelector(s),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,NS=window.NS,D=window.NammaData.destinations,THREE=window.THREE;
let renderer=null;
try{renderer=new THREE.WebGLRenderer({canvas:$('#gl'),antialias:true})}catch(e){document.body.classList.add('nogl')}
const ls=new THREE.Scene(),lc=new THREE.PerspectiveCamera(38,1,.1,100);
ls.add(new THREE.AmbientLight(0x6070a0,.7));
const key=new THREE.DirectionalLight(0xbfe4ff,1.5);key.position.set(4,5,6);ls.add(key);
const rim=new THREE.PointLight(0x5b7cff,3,24);rim.position.set(-5,-2,3);ls.add(rim);
const ml=new THREE.DirectionalLight(0x9fc3ff,1.6);ml.position.set(-8,10,6);ls.add(ml);
const pa=new Float32Array(5400);for(let i=0;i<1800;i++){const r=40+Math.random()*40,a=Math.random()*6.283,b=Math.acos(2*Math.random()-1);pa.set([r*Math.sin(b)*Math.cos(a),r*Math.cos(b),r*Math.sin(b)*Math.sin(a)],i*3)}
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pa,3));
const pts=new THREE.Points(pg,new THREE.PointsMaterial({color:0xcfe0ff,size:.3,transparent:true,opacity:.85}));ls.add(pts);
const mtex=(()=>{const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d');g.fillStyle='#5a6482';g.fillRect(0,0,1024,512);
 for(let i=0;i<500;i++){g.fillStyle='rgba('+(Math.random()<.5?'20,28,50':'120,135,170')+','+(.04+Math.random()*.08)+')';g.beginPath();g.arc(Math.random()*1024,Math.random()*512,10+Math.random()*60,0,6.283);g.fill()}
 for(let i=0;i<1400;i++){const x=Math.random()*1024,y=Math.random()*512,r=1.5+Math.pow(Math.random(),3)*34,gr=g.createRadialGradient(x,y,r*.1,x,y,r);gr.addColorStop(0,'rgba(15,20,38,.55)');gr.addColorStop(.8,'rgba(30,40,70,.25)');gr.addColorStop(.92,'rgba(150,165,200,.45)');gr.addColorStop(1,'rgba(150,165,200,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,6.283);g.fill()}
 const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t})();
const moonG=new THREE.Group(),MR=14;
const moon=new THREE.Mesh(new THREE.SphereGeometry(MR,128,96),new THREE.MeshStandardMaterial({map:mtex,bumpMap:mtex,bumpScale:2,roughness:1,metalness:0,color:0x9aa8cc}));
const sunU={value:new THREE.Vector3()},sunW=new THREE.Vector3(-8,10,6).normalize();
const atmU={uC:{value:new THREE.Vector3()},uR:{value:MR}};
const atm=new THREE.Mesh(new THREE.SphereGeometry(MR*1.3,64,48),new THREE.ShaderMaterial({uniforms:atmU,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
vertexShader:'varying vec3 vP;void main(){vec4 m=modelViewMatrix*vec4(position,1.);vP=m.xyz;gl_Position=projectionMatrix*m;}',
fragmentShader:`varying vec3 vP;uniform vec3 uC;uniform float uR;
void main(){vec3 d=normalize(vP);float h=length(uC-d*dot(uC,d))/uR;
 float i=h<1.?pow(h,18.):exp(-(h-1.)*70.);float hz=exp(-(h-1.)*9.)*.09*step(1.,h);
 vec3 c=mix(vec3(.2,.45,1.),vec3(.85,.94,1.),pow(i,5.))*i+vec3(.12,.25,.6)*hz;
 gl_FragColor=vec4(c,1.);}`}));
moonG.add(moon,atm);ls.add(moonG);
new THREE.GLTFLoader().load('/assets/earth.glb',gl=>{const g=gl.scene,bx=new THREE.Box3().setFromObject(g),c=bx.getCenter(new THREE.Vector3()),z=bx.getSize(new THREE.Vector3()),p=new THREE.Group();g.position.sub(c);p.add(g);p.scale.setScalar(MR*2/Math.max(z.x,z.y,z.z));p.rotation.z=.41;g.traverse(o=>{if(o.isMesh){const m=o.material;if(m.map)m.map.anisotropy=8;o.material=new THREE.ShaderMaterial({uniforms:{map:{value:m.map},uSun:sunU},vertexShader:'varying vec2 vUv;varying vec3 vN;void main(){vUv=uv;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D map;uniform vec3 uSun;varying vec2 vUv;varying vec3 vN;void main(){vec3 c=texture2D(map,vUv).rgb;float d=max(dot(normalize(vN),uSun),0.);float l=.1+.95*smoothstep(0.,.85,d);gl_FragColor=vec4(c*l,1.);}'})}});moon.add(p);moon.material.visible=false},undefined,e=>console.warn('earth.glb failed; using procedural moon fallback',e));
let mx=0,my=0,trans=null,busy=false,dg=false,lx=0,ly=0,mvx=0,lvx=0,bgl=0,lsy=0;
addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
const hero=$('#hero');
hero.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;dg=true;lx=e.clientX;ly=e.clientY;lvx=0;hero.setPointerCapture(e.pointerId);hero.classList.add('dg')});
hero.addEventListener('pointermove',e=>{if(!dg)return;lvx=(e.clientX-lx)*.005;moon.rotation.y+=lvx;moon.rotation.x=Math.max(-.6,Math.min(.6,moon.rotation.x+(e.clientY-ly)*.004));lx=e.clientX;ly=e.clientY});
['pointerup','pointercancel'].forEach(t=>hero.addEventListener(t,()=>{if(dg){mvx=lvx;dg=false;hero.classList.remove('dg')}}));
const ease3=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2,veil=$('#veil');
function updLand(now){
  const m=innerWidth<=900,bd=Math.min(.05,(now-bgl)/1000)*(reduce?0:1),sy=scrollY;bgl=now;
  moon.rotation.y+=(sy-lsy)*.0006;lsy=sy;if(!dg){moon.rotation.y+=bd*.02+mvx;mvx*=.95}
  moonG.position.set(m?.5:5,(m?-12.8:-12.3)+Math.min(sy,2400)*.0025,-10);
  lc.position.set(0,0,8);pts.rotation.y=now/40000;
  if(trans){
    const p=Math.min(1,(now-trans.t0)/1800),e=ease3(p);
    moonG.scale.setScalar(1+e*.42);
    lc.position.set(mx*.6+e*1.5,-my*.4-e*3,8-e*5.5);
    veil.style.transition='none';veil.style.opacity=p>.72?((p-.72)/.28).toFixed(3):0;
    if(p>=1){moonG.scale.setScalar(1);trans=null;location.assign('/experience/')}
  }
  if(trans)lc.lookAt(moonG.position);else lc.lookAt(mx*.6,-my*.4,0);lc.updateMatrixWorld();atmU.uC.value.copy(moonG.position).applyMatrix4(lc.matrixWorldInverse);sunU.value.copy(sunW).transformDirection(lc.matrixWorldInverse);
}
function enter(){
  if(busy)return;busy=true;
  if(!renderer||reduce){location.assign('/experience/');return}
  document.body.classList.add('leaving');trans={t0:performance.now()};
}
/* ---- corridor ---- */
const es=new THREE.Scene();es.background=new THREE.Color(0x07080d);es.fog=new THREE.Fog(0x07080d,6,34);
const ec=new THREE.PerspectiveCamera(72,1,.05,80);ec.rotation.order='YXZ';
function tex(a,b,rx,ry){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle=a;g.fillRect(0,0,64,64);g.strokeStyle=b;g.lineWidth=2;g.strokeRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);return t}
const std=(c,m)=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8},m||{}));
function box(w,h,d,x,y,z,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);es.add(m);return m}
const wallM=std(0x8e97ad),ceilM=std(0x20242f),lightM=new THREE.MeshBasicMaterial({color:0xf2f8ff});
const R=[[-1.5,1.5,-36.2,0],[-6,6,-48,-35.8]];
function sign(t,w,h,x,y,z,ry){const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);const g=c.getContext('2d');
  g.fillStyle='#0a0e18';g.fillRect(0,0,c.width,c.height);g.strokeStyle='#8fd3ff';g.lineWidth=6;g.strokeRect(3,3,c.width-6,c.height-6);
  g.fillStyle='#e8ecf4';g.font='bold '+Math.round(c.height*.42)+'px monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(t,c.width/2,c.height/2);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));m.position.set(x,y,z);m.rotation.y=ry;es.add(m)}
function buildExp(){
  box(3.2,.1,36,0,-.05,-18,std(0x2a2f3d,{map:tex('#2a2f3d','#3a4256',3,36)}));
  box(12,.1,12,0,-.05,-42,std(0x2a2f3d,{map:tex('#2a2f3d','#3a4256',12,12)}));
  box(3.4,.1,36,0,3.05,-18,ceilM);box(12.2,.1,12,0,3.05,-42,ceilM);
  box(.2,3,36,-1.6,1.5,-18,wallM);box(.2,3,36,1.6,1.5,-18,wallM);box(3.4,3,.2,0,1.5,.1,wallM);
  box(4.5,3,.2,-3.75,1.5,-36,wallM);box(4.5,3,.2,3.75,1.5,-36,wallM);
  box(.2,3,12,-6.1,1.5,-42,wallM);box(.2,3,12,6.1,1.5,-42,wallM);box(12.4,3,.2,0,1.5,-48.1,wallM);
  for(let z=-4;z>-36;z-=6)box(.5,.04,1.4,0,2.98,z,lightM);
  box(2,.04,2,-3,2.98,-42,lightM);box(2,.04,2,3,2.98,-42,lightM);
  [-6,-18,-30].forEach(z=>{const l=new THREE.PointLight(0xdbe9ff,.9,16);l.position.set(0,2.6,z);es.add(l)});
  const hl=new THREE.PointLight(0xdbe9ff,1.1,18);hl.position.set(0,2.6,-42);es.add(hl);
  es.add(new THREE.HemisphereLight(0x8fa0c8,0x1a1d28,.45));
  D.forEach(d=>{
    if(d.s){box(.06,2.3,1.1,d.s*1.5,1.15,d.z,std(d.c,{emissive:d.c,emissiveIntensity:.25}));sign(d.n,1.3,.33,d.s*1.46,2.6,d.z,-d.s*Math.PI/2)}
    else sign(d.n,4,1,0,2.1,-47.9,0)});
  box(6,.3,2.5,0,.15,-46.5,std(0x3a4256));
  const cm=std(0x1c2a46);for(let r=0;r<3;r++)for(let c=-2;c<=2;c++)box(.55,.5,.55,c*1.1,.25,-39.5-r*1.4,cm);
}
let built=false;
const P={x:0,z:-2,yaw:0,pitch:0},K={};let route=null,ri=0,turn=null,drag=false,destName='';
const st=t=>NS.onStatus&&NS.onStatus(t),ok=(x,z)=>R.some(r=>x>=r[0]+.3&&x<=r[1]-.3&&z>=r[2]+.3&&z<=r[3]-.3),ang=a=>Math.atan2(Math.sin(a),Math.cos(a));
function go(d){
  const tz=d.s?d.z:-41,p=[];
  if(P.z<-35.5){if(tz>-36)p.push({x:0,z:-37})}else if(Math.abs(P.x)>.05)p.push({x:0,z:P.z});
  p.push({x:0,z:tz});if(d.s)p.push({x:d.s,z:tz});
  route=p;ri=0;turn=-d.s*Math.PI/2;destName=d.n;st('Walking to '+d.n+' (guided prototype route)');
}
function updExp(dt){
  const f=(K.w||K.arrowup?1:0)-(K.s||K.arrowdown?1:0),sd=(K.d?1:0)-(K.a?1:0);
  if(K.arrowleft)P.yaw+=dt*1.8;if(K.arrowright)P.yaw-=dt*1.8;
  if(f||sd){if(route){route=null;turn=null;st('Guided walk cancelled.')}
    const s=2.6*dt,sy=Math.sin(P.yaw),cy=Math.cos(P.yaw),dx=(-sy*f+cy*sd)*s,dz=(-cy*f-sy*sd)*s;
    if(ok(P.x+dx,P.z))P.x+=dx;if(ok(P.x,P.z+dz))P.z+=dz}
  if(route){const t=route[ri],dx=t.x-P.x,dz=t.z-P.z,d=Math.hypot(dx,dz);
    if(d<.08){ri++;if(ri>=route.length)route=null}
    else{const s=Math.min(d,3.2*dt);P.x+=dx/d*s;P.z+=dz/d*s;P.yaw+=ang(Math.atan2(-dx,-dz)-P.yaw)*Math.min(1,dt*6)}}
  else if(turn!==null){const a=ang(turn-P.yaw);P.yaw+=a*Math.min(1,dt*6);if(Math.abs(a)<.01){turn=null;st('Arrived at '+destName+'.')}}
  ec.position.set(P.x,1.6,P.z);ec.rotation.set(P.pitch,P.yaw,0);drawMap();
}
const mc=$('#mm'),mg=mc.getContext('2d'),S=4.4,X=z=>8-z*S,Y=x=>4+(x+6)*S;
function drawMap(){
  mg.clearRect(0,0,236,62);mg.fillStyle='rgba(143,170,255,.16)';mg.strokeStyle='rgba(190,210,255,.45)';
  R.forEach(r=>{mg.fillRect(X(r[3]),Y(r[0]),(r[3]-r[2])*S,(r[1]-r[0])*S);mg.strokeRect(X(r[3]),Y(r[0]),(r[3]-r[2])*S,(r[1]-r[0])*S)});
  mg.fillStyle='#ffd37a';D.forEach(d=>{mg.fillRect(X(d.s?d.z:-44)-2,Y(d.s*1.5)-2,4,4)});
  if(route){mg.strokeStyle='#8fd3ff';mg.beginPath();mg.moveTo(X(P.z),Y(P.x));for(let i=ri;i<route.length;i++)mg.lineTo(X(route[i].z),Y(route[i].x));mg.stroke()}
  const px=X(P.z),py=Y(P.x);mg.fillStyle='#fff';mg.beginPath();mg.arc(px,py,3,0,6.283);mg.fill();
  mg.strokeStyle='#fff';mg.beginPath();mg.moveTo(px,py);mg.lineTo(px+Math.cos(P.yaw)*9,py-Math.sin(P.yaw)*9);mg.stroke();
}
addEventListener('keydown',e=>{if(!document.body.classList.contains('exp')||e.target.tagName==='INPUT')return;const k=e.key.toLowerCase();K[k]=true;if(k.startsWith('arrow'))e.preventDefault()});
addEventListener('keyup',e=>{delete K[e.key.toLowerCase()]});
const cv=$('#gl');
cv.addEventListener('pointerdown',e=>{if(document.body.classList.contains('exp')){drag=true;cv.setPointerCapture(e.pointerId)}});
cv.addEventListener('pointerup',()=>drag=false);
cv.addEventListener('pointermove',e=>{if(!drag)return;P.yaw-=e.movementX*.004;P.pitch=Math.max(-1.2,Math.min(1.2,P.pitch-e.movementY*.004));turn=null});
Object.assign(NS,{enter,go,key:(k,v)=>{if(v)K[k]=true;else delete K[k]},reset:()=>{route=null;turn=null;P.x=0;P.z=-2;P.yaw=0;P.pitch=0;st('View reset.')}});
/* ---- routing ---- */
function showExp(){
  location.replace('/experience/');
}
function showLand(){
  if(!document.body.classList.contains('exp'))return;
  document.body.classList.remove('exp','leaving');
  trans=null;busy=false;veil.style.transition='none';veil.style.opacity=0;scrollTo(0,0);
  dispatchEvent(new CustomEvent('nsmode',{detail:'land'}));
}
const route2=()=>location.hash==='#experience'?showExp():showLand();
addEventListener('hashchange',route2);
function rs(){const w=innerWidth,hh=innerHeight;if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(w,hh,false)}lc.aspect=ec.aspect=w/hh;lc.updateProjectionMatrix();ec.updateProjectionMatrix()}
addEventListener('resize',rs);rs();
let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(!renderer)return;
  if(document.body.classList.contains('exp')){updExp(dt);renderer.render(es,ec)}else{updLand(now);renderer.render(ls,lc)}}
requestAnimationFrame(frame);
route2();
})();
