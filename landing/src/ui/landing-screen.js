(()=>{
  const {h,M,rv,ease,Card,Section,Button,enterButton}=window.NammaUI;
  const Nav=()=>h('div',{className:'navw'},h(M.nav,{className:'glass',initial:{y:-30,opacity:0},animate:{y:0,opacity:1},transition:{duration:.7,ease}},
    h('a',{className:'logo',href:'#home'},'NAMMA SPACE'),
    h('div',{className:'nl'},h('a',{href:'#platform'},'Platform'),h('a',{href:'#how'},'How it works'),h('a',{href:'#roadmap'},'Roadmap')),
    enterButton('Enter Namma Space ↗','p')));
  function Hero(){const{scrollY}=window.NammaUI.useScroll(),y=window.NammaUI.useTransform(scrollY,[0,500],[0,-70]),o=window.NammaUI.useTransform(scrollY,[0,420],[1,0]);return h('header',{id:'hero'},
    h(M.div,{className:'t',style:{y,opacity:o},initial:{opacity:0},animate:{opacity:1},transition:{duration:1.2,delay:.3}},
      h('h1',null,'REAL SPACES.',h('br'),'DIGITAL WORLDS.'),
      h('p',{className:'sub'},'Step inside photorealistic digital twins of physical spaces. Explore corridors, discover destinations, and experience indoor navigation in a new dimension.')),
    h(M.div,{className:'br',initial:{opacity:0,x:30},animate:{opacity:1,x:0},transition:{duration:.8,delay:.7,ease}},enterButton('ENTER NAMMA SPACE ↗','p'),h('a',{href:'#platform',className:'gb'},'EXPLORE THE EXPERIENCE ↗')));}
  const stat=(b,s,i)=>h(Card,{i,key:b},h('div',{className:'big'},b),h('div',{className:'sm'},s));
  const step=(t,s,i)=>h(Card,{i,key:t},h('h3',null,t),h('p',{className:'sm'},s));
  const roadmap=(cls,tag,items,i)=>h(Card,{i,key:tag},h('span',{className:'tag '+cls},tag),h('ul',null,items.map(x=>h('li',{key:x},x))));
  function Landing(){return h('div',{id:'land'},h(Nav),h(Hero),
    h(Section,{id:'platform',idx:'S.01 Platform',t:'Walk through a real space from any browser, then find your way around it.'},h('div',{className:'grid'},stat('WebGL','Runs in the browser. Nothing to install.',0),stat('First person','Walk with WASD, arrows, touch pad or mouse drag, with wall collision.',1),stat('Routes','Search a destination and take a guided walk (prototype).',2),stat('VR + AR','Planned. Not part of this demo.',3))),
    h(Section,{id:'how',idx:'S.02 How it works',t:'From a physical corridor to a twin you can search.'},h('div',{className:'grid'},step('01 Capture','Photograph or scan a real indoor space such as a corridor, lab or hall.',0),step('02 Reconstruct','Turn the capture into a 3D environment with a floor plan and walkable areas.',1),step('03 Navigate','Tag rooms and landmarks, then let visitors search and walk to them.',2))),
    h(Section,{id:'roadmap',idx:'S.03 Roadmap',t:'What works today, and what does not yet.'},h('div',{className:'grid'},roadmap('ok','WORKING',['3D first-person viewer','Wall collision','Destination search','Guided walk and minimap'],0),roadmap('pr','PROTOTYPE',['Demo corridor (procedural model, not a scan)','Straight-corridor route only'],1),roadmap('','PLANNED',['Photorealistic reconstruction loading','General pathfinding','WebXR VR mode','AR overlay'],2))),
    h('section',{className:'sec'},h(M.div,{className:'glass end',...rv,transition:{duration:.7,ease}},h('h2',null,'Cross the threshold.'),enterButton('ENTER NAMMA SPACE','p'))),
    h('footer',{className:'glass'},h('span',null,'© 2026 Namma Space'),h('span',null,'Prototype build'),h('span',null,'Earth model by Akshat on Sketchfab · CC BY 4.0 · ',h('a',{href:'https://sketchfab.com/3d-models/earth-41fc80d85dfd480281f21b74b2de2faa',target:'_blank',rel:'noreferrer'},'model source'))));}
  window.NammaScreens.Landing=Landing;
})();
