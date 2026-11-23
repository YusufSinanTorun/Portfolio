(() => {
const frame=document.querySelector(".hm.image");
const reveal=frame.querySelector(".reveal");
const ctx=reveal.getContext("2d");
let pointer = null;

reveal.width=1672; reveal.height=941;
const original=new Image(); original.src="../gfx/bg-0.png";

const stamp=document.createElement("canvas");
stamp.width=stamp.height=600;

const brush=stamp.getContext("2d");
const gradient=brush.createRadialGradient(300,300,0,300,300,300);

gradient.addColorStop(0,  "rgba(0,0,0,0.60)");
gradient.addColorStop(0.4,"rgba(0,0,0,0.30)");
gradient.addColorStop(0.9,"rgba(0,0,0,0)");
gradient.addColorStop(1,  "rgba(0,0,0,0)");

brush.fillStyle=gradient;
brush.fillRect(0,0,600,600);
let active=false; let moving=false; let x=0; let y=0; let targetX=0; let targetY=0;
const LIMIT = {top: 40, bottom: 900, fade: 140};

function limitVerticalEdge(){
    const gradient = ctx.createLinearGradient(0, 0, 0, reveal.height);
    const ease = t => t * t * (3 - 2 * t);

    gradient.addColorStop(0, "rgba(0,0,0,0)");

    for (const t of [0, 0.25, 0.5, 0.75, 1]){
        gradient.addColorStop(
            (LIMIT.top + LIMIT.fade * t) / reveal.height,
            `rgba(0,0,0,${ease(t)})`);}

    for (const t of [0, 0.25, 0.5, 0.75, 1]){
        gradient.addColorStop(
            (LIMIT.bottom - LIMIT.fade + LIMIT.fade * t) / reveal.height,
            `rgba(0,0,0,${1 - ease(t)})`);}

    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, reveal.width, reveal.height);}
    
function smoothstep(value){
    const t=Math.max(0,Math.min(1,value));
    return t*t*(3-2*t);}
    
function draw(){
    ctx.clearRect(0,0,reveal.width,reveal.height);
    if(!original.complete||!original.naturalWidth)return;
    const imageScale=Math.min(reveal.width/original.naturalWidth,reveal.height/original.naturalHeight);
    const imageWidth=original.naturalWidth*imageScale;
    const imageHeight=original.naturalHeight*imageScale;
    
    ctx.drawImage(original,(reveal.width-imageWidth)/2,(reveal.height-imageHeight)/2,imageWidth,imageHeight);
    
    const cover=Math.min(frame.clientWidth/reveal.width,frame.clientHeight/reveal.height);
    const offsetX=(frame.clientWidth-reveal.width*cover)/2;
    const offsetY=(frame.clientHeight-reveal.height*cover)/2;
    const imageX=(x-offsetX)/cover;
    const imageY=(y-offsetY)/cover;
    const maskWidth=Math.min(1250,Math.max(420,frame.clientWidth*0.90))/cover;
    const maskHeight=maskWidth*stamp.height/stamp.width;
    
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(stamp, imageX - maskWidth / 2, imageY - maskHeight / 2, maskWidth, maskHeight);
    limitVerticalEdge();

    const mouseOpacity =
        smoothstep((imageY - LIMIT.top) / LIMIT.fade) *
        smoothstep((LIMIT.bottom - imageY) / LIMIT.fade);

    ctx.fillStyle = `rgba(0,0,0,${mouseOpacity})`;
    ctx.fillRect(0, 0, reveal.width, reveal.height);
    ctx.globalCompositeOperation = "source-over";}
    
function animate(){
    if(!active){moving=false;return;}

    x+=(targetX-x)*0.14;
    y+=(targetY-y)*0.14;draw();
    
    if(Math.hypot(targetX-x,targetY-y)>0.5){
        requestAnimationFrame(animate);}else{moving=false;}}

function showAt(nextX,nextY){
    if(!active){x=nextX;y=nextY;active=true;}
    targetX=nextX;targetY=nextY;
    if(!moving){moving=true;requestAnimationFrame(animate);}}
    
function hide(){
    active = false;
    ctx.clearRect(0, 0, reveal.width, reveal.height);}

function trackAt(clientX, clientY){
    const box = frame.getBoundingClientRect();

    if(
        clientX < box.left || clientX > box.right ||
        clientY < box.top || clientY > box.bottom) {
        hide();
        return;}

    showAt(clientX - box.left, clientY - box.top);}

function trackPointer(event){
    if(event.pointerType === "touch") return;
    pointer = { x: event.clientX, y: event.clientY };
    trackAt(pointer.x, pointer.y);}

window.addEventListener("pointermove", trackPointer, { passive: true });

window.addEventListener("scroll", () =>{
    if(pointer){
        requestAnimationFrame(() => trackAt(pointer.x, pointer.y));}}, { passive: true });

window.addEventListener("pointerout", event =>{
    if(event.relatedTarget === null){
        pointer = null;
        hide();}});

frame.addEventListener("focus",()=>{showAt(frame.clientWidth/2,frame.clientHeight/2);});
frame.addEventListener("blur",hide);
original.addEventListener("load",()=>{if(active)draw();});})();