(()=>{
  window.NS={};
  window.NammaData={destinations:[
    {n:'Room 101',s:-1,z:-7,c:0x2b4a7a},{n:'Room 102',s:1,z:-13,c:0x2b4a7a},{n:'Computer Lab',s:-1,z:-21,c:0x4a2b7a},{n:'Library',s:1,z:-28,c:0x2b7a5a},{n:'Seminar Hall',s:0,z:-44,c:0}
  ]};
  const {createElement:h,useState,useEffect}=window.React;
  const {motion:M,AnimatePresence:AP,MotionConfig:MC,useScroll,useTransform}=window.Motion;
  const rv={initial:{opacity:0,y:28},whileInView:{opacity:1,y:0},viewport:{once:true,margin:'-60px'}};
  const ease=[.22,1,.36,1];
  const Card=({children,i=0})=>h(M.div,{className:'glass card',...rv,transition:{duration:.6,ease,delay:i*.08},whileHover:{y:-5,transition:{duration:.2}}},children);
  const Section=({id,idx,t,children})=>h('section',{className:'sec',id},h('div',{className:'in'},h(M.div,{...rv,transition:{duration:.6,ease}},h('div',{className:'idx'},idx),h('h2',null,t)),children));
  const Button=({cls='',children,...p})=>h(M.button,{className:'gb '+cls,whileHover:{scale:1.04},whileTap:{scale:.96},...p},children);
  const enterButton=(label,cls)=>h(Button,{cls,onClick:()=>window.NS.enter()},label);
  window.NammaUI={h,useState,useEffect,M,AP,MC,useScroll,useTransform,rv,ease,Card,Section,Button,enterButton};
  window.NammaScreens={};
})();
