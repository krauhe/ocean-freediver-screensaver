/* SPDX-License-Identifier: GPL-3.0-only
 * Slow individual swimming headings, with flow shear and depth responses.
 * Behavioural approximation; angles/rates are visual tuning parameters.
 */
(() => {
  window.createJellyOrientation=function(T,kind='moon'){
    const up=new T.Vector3(0,1,0);
    const axis=new T.Vector3(),goal=new T.Vector3(),desired=new T.Vector3();
    const above=new T.Vector3(),below=new T.Vector3(),aFlow=new T.Vector3(),bFlow=new T.Vector3();
    const target=new T.Quaternion(),twist=new T.Quaternion(),quaternion=new T.Quaternion();
    let next=-Infinity,last=null,spin=Math.random()*Math.PI*2,spinRate=(Math.random()-.5)*.025;
    function choose(){
      const y=kind==='moon'?-.45+Math.random()*1.4:-.95+Math.random()*1.9;
      const angle=Math.random()*Math.PI*2,r=Math.sqrt(1-y*y);
      goal.set(r*Math.cos(angle),y,r*Math.sin(angle));
    }
    choose();quaternion.setFromUnitVectors(up,goal);axis.copy(goal);
    return {axis,quaternion,update(time,position,environment,pulse=0){
      const dt=last===null?0:Math.max(0,Math.min(.25,time-last));last=time;
      if(time>=next){choose();next=time+18+Math.random()*35;spinRate=(Math.random()-.5)*.025;}
      desired.copy(goal);
      if(environment){
        above.copy(position);below.copy(position);above.y+=.5;below.y-=.5;
        environment.current(above,time,aFlow);environment.current(below,time,bFlow);
        desired.addScaledVector(aFlow.sub(bFlow),3);
      }
      // Bias swimming away from the surface and deep floor, without snapping.
      desired.y-=Math.max(0,position.y-8)*.3;
      desired.y+=Math.max(0,-16-position.y)*.22;
      desired.normalize();target.setFromUnitVectors(up,desired);
      spin+=spinRate*dt;twist.setFromAxisAngle(up,spin);target.multiply(twist);
      const angle=quaternion.angleTo(target),rate=kind==='moon'?.055+.13*pulse:.07;
      if(dt>0&&angle>1e-7)quaternion.slerp(target,Math.min(1,rate*dt/angle));
      axis.set(0,1,0).applyQuaternion(quaternion);
      return quaternion;
    }};
  };
})();
