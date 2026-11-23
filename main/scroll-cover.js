const opening = document.querySelector(".opening");
const topbar = opening.querySelector(".top");
const image = opening.querySelector(".hm.image");
const content = document.querySelector("#content");

const speed = 2.25;
let start = 0; let duration = 1; let waiting = false;

function measure(){
    const openingTop = window.scrollY + opening.getBoundingClientRect().top;
    const imageBottom = openingTop + image.offsetHeight;

    start = Math.max(openingTop, imageBottom - window.innerHeight * 0.9);

    const originalDuration = Math.max(220, Math.min(window.innerHeight * 1.2, image.offsetHeight * 1.35));
    const untilTopbar = Math.max(0, (imageBottom - start - 5) / speed);
    duration = Math.min(originalDuration, untilTopbar);
    const hold = start - openingTop + duration;

    opening.style.setProperty("--topbar-height", `${topbar.offsetHeight}px`);
    opening.style.paddingBottom = `${hold}px`;
    
    content.style.marginTop = `-${hold}px`; content.style.marginBottom = "0px";
    content.style.transform = "none";
    content.style.paddingBottom = "0px";
    
    update();}

function update(){
    waiting = false;

    const distance = Math.max(0, Math.min(duration, window.scrollY - start));
    const hold = start - (window.scrollY + opening.getBoundingClientRect().top) + duration;
    content.style.marginTop=`-${hold + (speed - 1) * distance}px`;

    const height = topbar.offsetHeight;
    const panelTop = content.getBoundingClientRect().top;
    const upward = Math.max(0, Math.min(height, height - panelTop - 5));

    topbar.style.transform = `translate3d(0, -${upward}px, 0)`;
    topbar.style.visibility = upward >= height ? "hidden" : "";}

window.addEventListener("scroll", () => {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(update);},{passive: true });

window.addEventListener("resize", measure);measure();

window.addEventListener("pageshow", measure);