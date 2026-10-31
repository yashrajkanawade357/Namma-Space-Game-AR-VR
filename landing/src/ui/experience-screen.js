(()=>{
  const {h,useState,useEffect,M,AP,Button}=window.NammaUI,NS=window.NS,D=window.NammaData.destinations;
  const padButton=(k,t)=>h('button',{key:k,className:'glass','aria-label':'Move '+k,onPointerDown:e=>{e.preventDefault();NS.key(k,1)},onPointerUp:()=>NS.key(k,0),onPointerLeave:()=>NS.key(k,0),onPointerCancel:()=>NS.key(k,0)},t);
  function Experience(){
    const[open,setOpen]=useState(false),[q,setQ]=useState(''),[st,setSt]=useState('Pick a destination to start a guided walk.');
    useEffect(()=>{const listener=e=>setOpen(e.detail==='exp');addEventListener('nsmode',listener);NS.onStatus=setSt;setOpen(document.body.classList.contains('exp'));return()=>removeEventListener('nsmode',listener)},[]);
    const matches=D.filter(d=>d.n.toLowerCase().includes(q.toLowerCase()));
    const panel=(delay,offset)=>({animate:{opacity:open?1:0,...offset(open)},transition:{type:'spring',stiffness:110,damping:18,delay}});
    return h('div',{id:'exp'},
      h(M.div,{className:'xbar glass',...panel(.3,o=>({y:o?0:-24}))},h(Button,{onClick:()=>{location.hash='#home'}},'← Doorway'),h('span',null,'Prototype corridor')),
      h(M.div,{className:'side glass',...panel(.45,o=>({x:o?0:-40}))},h('div',{className:'lab'},'Destinations'),
        h('input',{value:q,onChange:e=>setQ(e.target.value),onKeyDown:e=>{if(e.key==='Enter'&&matches[0])NS.go(matches[0])},placeholder:'Search a room','aria-label':'Search destinations',autoComplete:'off'}),
        h('div',{className:'dl'},h(AP,{initial:false},matches.map(d=>h(M.button,{key:d.n,layout:true,initial:{opacity:0,x:-10},animate:{opacity:1,x:0},exit:{opacity:0,x:10},whileHover:{x:4},onClick:()=>NS.go(d)},d.n))),!matches.length&&h('div',{className:'sm'},'No match. Try “Room”, “Lab” or “Hall”.')),
        h('div',{id:'st',role:'status','aria-live':'polite'},st)),
      h(M.div,{className:'modes',...panel(.5,o=>({x:o?0:40}))},h('button',{className:'gb',disabled:true,title:'WebXR is not implemented yet'},'ENTER VR · COMING SOON'),h('button',{className:'gb',disabled:true},'AR · PLANNED'),h(Button,{onClick:()=>NS.reset()},'RESET VIEW'),h('small',null,'Both modes are future work. This is a normal 3D browser session.')),
      h(M.div,{className:'mm glass',...panel(.6,o=>({y:o?0:40}))},h('canvas',{id:'mm',width:236,height:62,'aria-label':'Minimap'})),
      h('div',{className:'kh glass'},'WASD / arrows to move',h('br'),'drag to look'),
      h('div',{className:'pad'},h('span',{key:'a'}),padButton('w','↑'),h('span',{key:'b'}),padButton('a','←'),padButton('s','↓'),padButton('d','→')),
      h('div',{id:'nogl'},h('div',null,'WebGL is not available in this browser.',h('br'),'Try a current Chrome, Edge, Firefox or Safari.',h('br'),' ',h('br'),h(Button,{onClick:()=>{location.hash='#home'}},'Back to Doorway'))));
  }
  window.NammaScreens.Experience=Experience;
})();
