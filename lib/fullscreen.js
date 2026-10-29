import {$,icon} from './ui.js';
// Keep the room description in the fullscreen subtree. Use a CSS fallback on
// browsers which cannot fullscreen an arbitrary HTML element (including phones).
export class MapFullscreen{
  constructor(onChange=()=>{}){
    this.active=false;this.onChange=onChange;this.main=$('main');
    this.details=$('roomDetails');this.parent=this.details.parentNode;
    this.returnFocus=null;
    document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement!==this.main&&this.active&&!this.fallback)this.restore();});
  }
  async toggle(){if(this.active){await this.exit();return;}await this.enter();}
  async enter(){
    if(this.active)return;
    this.active=true;this.fallback=false;this.returnFocus=document.activeElement;
    this.main.append(this.details,$('shareDialog'),$('toast'));
    this.main.classList.add('is-fullscreen');document.body.classList.add('map-fullscreen');
    $('fullscreen').setAttribute('aria-label','Exit fullscreen map');$('fullscreen').title='Exit fullscreen map';$('fullscreen').innerHTML=icon('close');$('fullscreen').setAttribute('aria-pressed','true');
    try{if(!this.main.requestFullscreen)throw Error();await this.main.requestFullscreen();}catch{this.fallback=true;}
    this.onChange(true);this.main.focus({preventScroll:true});
  }
  async exit(){
    if(document.fullscreenElement===this.main){try{await document.exitFullscreen();}catch{}}
    if(this.active)this.restore();
  }
  restore(){
    this.active=false;this.fallback=false;
    this.parent.append(this.details);document.body.append($('shareDialog'),$('toast'));
    this.main.classList.remove('is-fullscreen');document.body.classList.remove('map-fullscreen');
    $('fullscreen').setAttribute('aria-label','Fullscreen map');$('fullscreen').title='Fullscreen map';$('fullscreen').innerHTML=icon('expand');$('fullscreen').setAttribute('aria-pressed','false');
    this.onChange(false);this.returnFocus?.focus({preventScroll:true});
  }
}
