/* Живой 3D-фон Зоны на главной: сглаженный 2.5D-объём по карте глубины без «плывущих» краёв
   плюс индивидуальные анимации для каждой из 12 тем (src/zone-scenes.js): живые костры с искрами
   и маревом, развевающиеся флаги, вращающиеся лопасти Ми-24, сканирующие прожекторы, мигающие
   маячки, аномалия «Электра», молнии выброса над ЧАЭС, дым из труб, плывущие облака и рябь воды.
   Всё рисует один шейдер (WebGL 1) с адаптацией под слабые устройства. */
import { readTheme, isMobile, lowPower } from "./zone-theme.js";
import { packSceneUniforms } from "./zone-scenes.js";

const VERT = "attribute vec2 a;varying vec2 vUv;void main(){vUv=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
const buildFrag = (OCT, GLOW, SPARKS) => /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uPhoto,uPhoto2,uDepth,uDepth2;
uniform vec2 uRes,uMouse,uCrop;
uniform float uT,uAspect,uDim,uMix,uFlash,uSceneVis;
uniform vec3 uAcc,uAcc2,uAnom;
uniform vec4 uSky,uWater,uAtmos,uSpecial;
uniform vec4 uFires[3],uFlags[2],uFlagDir[2],uBeams[3],uBeamOpt[3],uLights[4];
varying vec2 vUv;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<${OCT};i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return v;}

/* фото закрывает экран целиком (background-size: cover) */
vec2 cover(vec2 s,float zoom){float sa=uRes.x/uRes.y;vec2 u=s-.5;if(sa>uAspect)u.y*=uAspect/sa;else u.x*=sa/uAspect;return u/zoom+.5;}
float depthAt(vec2 p){float a=texture2D(uDepth,p).r;return uMix>0.?mix(a,texture2D(uDepth2,p).r,uMix):a;}
/* 5-точечное сглаживание глубины убирает «желе» и рваные силуэты при движении */
float depthSmooth(vec2 p){
  vec2 e=vec2(.0045,.0075);
  return depthAt(p)*.4
    +(depthAt(p+vec2(e.x,0.))+depthAt(p-vec2(e.x,0.))+depthAt(p+vec2(0.,e.y))+depthAt(p-vec2(0.,e.y)))*.15;
}
vec3 photo(vec2 p){vec3 a=texture2D(uPhoto,p).rgb;return uMix>0.?mix(a,texture2D(uPhoto2,p).rgb,uMix):a;}
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
/* перевод UV текущего кадра в универсальные координаты десктопного фото (0..1) */
vec2 toScene(vec2 p){return vec2(uCrop.x+p.x*uCrop.y,p.y);}

/* пыль, пепел и летящие искры в трёх слоях */
vec2 motes(vec2 s,float sc,float fall,float wind,float sd,float sz){
  vec2 q=s*vec2(uRes.x/uRes.y,1.)*sc+vec2(-uT*wind,uT*fall)+sd;
  vec2 id=floor(q),f=fract(q)-.5;float h=hash(id+sd);
  vec2 o=(vec2(hash(id+3.1),hash(id+7.7))-.5)*.6+.12*vec2(sin(uT*.7+h*30.),cos(uT*.6+h*20.));
  float k=smoothstep(sz,0.,length(f-o))*(.45+.55*sin(uT*1.3+h*40.));
  return vec2(k*step(.74,h)*step(h,.976),k*step(.976,h));
}

void main(){
  vec2 s=vUv;float ar=uRes.x/uRes.y;
  /* сдержанный, чёткий 2.5D-параллакс с мягким затуханием к краям экрана */
  vec2 edgeSafe=smoothstep(0.,.08,s)*smoothstep(1.,.92,s);
  float safeK=.35+.65*edgeSafe.x*edgeSafe.y;
  vec2 cam=uMouse*vec2(.0135,.0085)*safeK;
  vec2 uv=cover(s,1.06+.006*sin(uT*.14));
  vec2 p=uv;
  float d0=depthSmooth(uv);
  for(int i=0;i<4;i++){
    float di=depthAt(p);
    float dUse=mix(d0,min(di,d0+.16),.55);
    p=uv+cam*(dUse-.35);
  }
  float d=depthAt(p);
  vec2 sp=toScene(p);
  float sv=uSceneVis;

  /* 1. Развевающиеся флаги и знамёна: деформация строго внутри полотнища с креплением у древка */
  float flagShade=0.;
  for(int i=0;i<2;i++){
    vec4 fl=uFlags[i],fd=uFlagDir[i];
    if(fl.z<=0.)continue;
    vec2 rel=(sp-fl.xy)/fl.zw;
    if(abs(rel.x)<1.15&&abs(rel.y)<1.15){
      float mask=(1.-smoothstep(.76,1.08,abs(rel.x)))*(1.-smoothstep(.76,1.08,abs(rel.y)));
      float dist=fd.x>1.5 ? clamp((1.-rel.y)*.5,0.,1.)
        : fd.x<0. ? clamp((rel.x+1.)*.5,0.,1.) : clamp((1.-rel.x)*.5,0.,1.);
      float pin=smoothstep(.04,.35,dist);
      float ph=dist*fd.z-uT*fd.w+rel.y*2.4;
      float wv=sin(ph)+.45*sin(ph*1.85+1.3)+.2*cos(ph*.7-uT*1.1);
      float amp=fd.y*pin*mask*sv;
      if(fd.x>1.5) p.x+=wv*amp/max(uCrop.y,.35);
      else{ p.y+=wv*amp*.85; p.x+=cos(ph)*amp*.28/max(uCrop.y,.35); }
      flagShade+=wv*pin*mask*.11*sv;
    }
  }

  /* 2. Локальное тепловое марево строго над горящими кострами и бочками (без тряски зданий!) */
  for(int i=0;i<3;i++){
    vec4 f=uFires[i];
    if(f.w<=0.)continue;
    vec2 df=sp-f.xy;
    float rise=smoothstep(-.01,f.z*1.7,df.y)*(1.-smoothstep(f.z*1.5,f.z*3.6,df.y));
    float col=exp(-df.x*df.x/(f.z*f.z*.65));
    float heat=rise*col*f.w*sv;
    if(heat>.005){
      float hz=sin(df.y*110.-uT*10.5+noise(sp*28.-vec2(0.,uT*3.5))*6.28);
      p.x+=hz*.0022*heat/max(uCrop.y,.35);
      p.y+=cos(df.x*90.+uT*8.)*.001*heat;
    }
  }

  /* 3. Рябь воды и луж (только в водной зоне темы; сухие сапоги и ящики не дрожат) */
  if(uWater.y>.01&&sp.y<uWater.x){
    float wm=smoothstep(uWater.x,uWater.x-.12,sp.y);
    float rawLum=lum(photo(p));
    float wet=uWater.z>.5 ? 1. : smoothstep(.07,.24,rawLum);
    float rpl=sin(sp.y*260.+uT*2.6+noise(sp*vec2(18.,34.)+vec2(uT*.4,0.))*4.5);
    p.x+=rpl*.0012*uWater.y*wm*wet/max(uCrop.y,.35);
  }

  /* 4. Случайная пространственная аномалия: кольцо-линза */
  float ring=0.,core=0.;vec2 adir=vec2(0.);
  if(uAnom.z>=0.){
    vec2 ad=(s-uAnom.xy)*vec2(ar,1.);float r=length(ad);
    float R=.02+uAnom.z*.24;
    ring=exp(-pow((r-R)/.032,2.))*(1.-uAnom.z);
    core=exp(-r*r/.0015)*sin(min(uAnom.z*2.,1.)*3.14159);
    adir=r>1e-4?ad/r:vec2(0.);adir.x/=ar;
    p-=adir*(ring*.024+core*.02);
  }

  p=clamp(p,vec2(.001),vec2(.999));
  sp=toScene(p);
  vec3 c=photo(p);
  c*=1.+flagShade;

  /* 5. Плывущие облака (только на открытых сценах, с защитой силуэтов по глубине и горизонту) */
  if(uSky.x>.01){
    float sky=(1.-smoothstep(.04,.16,d))*smoothstep(uSky.z-.06,uSky.z+.12,sp.y)*uSky.x;
    if(sky>.002){
      float period=uSky.w>.5 ? 11. : 15.;
      float a=fract(uT/period),b=fract(uT/period+.5),wa=1.-abs(1.-2.*a);
      vec2 drift=vec2(-uSky.y,0.);
      if(uSky.w>.5){
        /* вихревые грозовые облака выброса в «Монолите» */
        vec2 sc=sp-vec2(.5,.58);
        drift=vec2(-sc.y*.06-.015,sc.x*.035);
      }
      vec2 w=vec2(fbm(sp*vec2(3.,5.)+uT*.022)-.5,fbm(sp*vec2(4.,6.)-uT*.016)-.5)*.01;
      vec2 pa=clamp(p+(drift*a+w)/vec2(max(uCrop.y,.35),1.),vec2(.001),vec2(.999));
      vec2 pb=clamp(p+(drift*b+w)/vec2(max(uCrop.y,.35),1.),vec2(.001),vec2(.999));
      float va=1.-smoothstep(.04,.16,depthAt(pa)),vb=1.-smoothstep(.04,.16,depthAt(pb));
      vec3 scCol=photo(pa)*wa*va+photo(pb)*(1.-wa)*vb+c*(wa*(1.-va)+(1.-wa)*(1.-vb));
      c=mix(c,scCol,sky);
    }
  }
  if(ring>.01){float ca=ring*.005;c.r=photo(p+adir*ca).r;c.b=photo(p-adir*ca).b;}

  /* 6. Мягкое свечение ярких пятен на фото */
  vec3 g=vec3(0.);
  for(int i=0;i<${GLOW};i++){
    float an=float(i)*2.39996,r=.0035+.0032*float(i)*${(8 / GLOW).toFixed(1)};
    vec3 q=photo(clamp(p+vec2(cos(an)/uAspect,sin(an))*r,vec2(.001),vec2(.999)));
    g+=q*smoothstep(.58,.94,lum(q));
  }
  c+=g/${GLOW}.*(.78+.22*noise(vec2(uT*5.,sp.x*22.+sp.y*14.)))*.95*vec3(1.,.86,.68);

  /* 7. Живые костры и горящие бочки: языки пламени, пульсирующий свет и летящие искры */
  for(int i=0;i<3;i++){
    vec4 f=uFires[i];
    if(f.w<=0.)continue;
    vec2 df=(sp-f.xy)*vec2(1.78,1.);
    float dist=length(df);
    float flk=.78+.22*sin(uT*8.7+float(i)*2.3)+.14*sin(uT*15.3+float(i)*5.1)+.12*noise(vec2(uT*7.5,float(i)*9.));
    /* тёплый отсвет костра на окружении */
    float glow=exp(-dist*dist/(f.z*f.z*3.6))*flk*f.w*.42*sv;
    c+=vec3(1.,.44,.12)*glow;
    /* процедурные языки пламени, тянущиеся вверх */
    if(dist<f.z*2.6){
      vec2 fq=df/f.z;
      float fn1=fbm(vec2(fq.x*3.4,fq.y*2.8-uT*4.4)+float(i)*7.);
      float fn2=noise(vec2(fq.x*7.5+sin(uT*6.+fq.y*4.)*.6,fq.y*5.5-uT*7.2));
      float shape=smoothstep(.88,-.15,length(vec2(fq.x*(1.35+max(0.,fq.y)*.85),(fq.y-.22)*.72)));
      float flame=clamp((shape+.52*(fn1-.42)+.25*(fn2-.5))*1.45,0.,1.)*smoothstep(-.55,.05,fq.y);
      vec3 fcol=mix(vec3(.95,.22,.03),vec3(1.,.74,.22),clamp(flame*1.35,0.,1.));
      fcol=mix(fcol,vec3(1.,.96,.78),smoothstep(.65,.95,flame));
      c+=fcol*flame*flame*.78*f.w*flk*sv;
      /* поднимающиеся от костра искры */
      vec2 eq=vec2(fq.x*4.2+sin(uT*1.6+fq.y*2.)*.55,fq.y*3.2-uT*2.3);
      vec2 eid=floor(eq),ef=fract(eq)-.5;
      float eh=hash(eid+float(i)*19.);
      float ep=smoothstep(.16,0.,length(ef-(vec2(hash(eid+2.1),hash(eid+6.3))-.5)*.55));
      float emask=smoothstep(-.1,.3,fq.y)*(1.-smoothstep(1.2,2.4,fq.y))*exp(-fq.x*fq.x*.85);
      c+=vec3(1.,.68,.24)*ep*step(.76,eh)*emask*1.65*f.w*sv;
    }
  }

  /* 8. Объёмные лучи прожекторов с плавным сканированием и пылью в луче */
  for(int i=0;i<3;i++){
    vec4 b=uBeams[i],bo=uBeamOpt[i];
    if(bo.z<=0.)continue;
    vec2 db=(sp-b.xy)*vec2(1.78,1.);
    float r=length(db);
    if(r<b.w*1.15){
      float ang=b.z+sin(uT*.48+float(i)*2.1)*bo.y;
      vec2 dir=vec2(cos(ang),sin(ang));
      float proj=dot(db,dir);
      if(proj>0.){
        float perp=abs(db.x*dir.y-db.y*dir.x);
        float halfW=.012+proj*tan(bo.x);
        float cone=smoothstep(halfW,halfW*.18,perp)*smoothstep(b.w,0.,proj)*smoothstep(0.,.02,proj);
        float dust=.72+.28*fbm(sp*vec2(9.,11.)+vec2(-uT*.28,uT*.12)+float(i)*4.);
        vec3 bcol=bo.w>1.5 ? vec3(.48,.94,1.) : bo.w>.5 ? vec3(1.,.93,.76) : vec3(.84,.92,1.);
        c+=bcol*cone*dust*bo.z*.48*sv;
      }
      /* вспышка линзы в точке прожектора */
      float lens=exp(-r*r/.00035)*bo.z*.55*sv;
      vec3 lcol=bo.w>1.5 ? vec3(.65,1.,1.) : vec3(1.,.96,.86);
      c+=lcol*lens;
    }
  }

  /* 9. Фонари, мигающие красные маячки, аварийные лампы и блики солнца/луны */
  for(int i=0;i<4;i++){
    vec4 lt=uLights[i];
    if(lt.w<.5)continue;
    vec2 dl=(sp-lt.xy)*vec2(1.78,1.);
    float r=length(dl);
    if(r<lt.z*3.2){
      float mode=lt.w;
      if(mode<1.5){
        /* тёплый фонарь + анаморфный блик */
        float flk=.84+.16*sin(uT*5.2+float(i)*3.1)+.08*sin(uT*13.7+float(i));
        float halo=exp(-r*r/(lt.z*lt.z))*flk;
        float flare=exp(-abs(dl.y)*90.)*exp(-abs(dl.x)/(lt.z*1.7))*.35*flk;
        c+=vec3(1.,.74,.36)*(halo*.34+flare*.3)*sv;
      }else if(mode<2.5){
        /* мигающий красный авиационный маячок */
        float cyc=fract(uT*.58+float(i)*.31);
        float blink=smoothstep(0.,.07,cyc)*(1.-smoothstep(.12,.34,cyc));
        float coreR=exp(-r*r/(lt.z*lt.z*.18));
        float haloR=exp(-r*r/(lt.z*lt.z*1.8));
        c+=vec3(1.,.14,.08)*(coreR*1.1+haloR*.45)*blink*sv;
      }else if(mode<3.5){
        /* холодная люминесцентная лампа с редким подмигиванием */
        float n=noise(vec2(uT*16.,float(i)*7.3));
        float flick=n<.1 ? .25 : .88+.12*sin(uT*3.5+float(i));
        float halo=exp(-r*r/(lt.z*lt.z*1.2))*flick;
        c+=vec3(.45,.92,1.)*halo*.38*sv;
      }else{
        /* солнце / луна / ядро неба */
        float pulse=.88+.12*sin(uT*.9+float(i));
        float halo=exp(-r*r/(lt.z*lt.z*1.6))*pulse;
        c+=mix(vec3(1.,.78,.45),uAcc2,.3)*halo*.26*sv;
      }
    }
  }

  /* 10. Уникальные сценовые эффекты каждой группировки */
  float stype=uSpecial.w;
  if(stype>.5&&sv>.01){
    if(stype<1.5){
      /* Военные: вращающиеся лопасти Ми-24 (главный + хвостовой винт) и навигационный строб */
      vec2 hd=(sp-uSpecial.xy)*vec2(1.78,1.);
      /* главный несущий винт в перспективе (эллипс) */
      vec2 re=vec2(hd.x/uSpecial.z,hd.y/(uSpecial.z*.19));
      float rr=length(re);
      if(rr<1.15){
        float ang=atan(re.y,re.x);
        /* 5 лопастей на высокой скорости вращения */
        float blades=pow(abs(cos(ang*2.5-uT*36.)),2.4);
        float blades2=pow(abs(cos(ang*5.-uT*26.)),4.);
        float disc=smoothstep(1.08,.75,rr)*smoothstep(.06,.22,rr);
        float glint=smoothstep(.6,1.,sin(ang-uT*9.))*.35+.65;
        c=mix(c,c*.7+vec3(.26,.31,.28),disc*blades*.65*sv);
        c+=vec3(.82,.9,.86)*disc*blades2*.34*glint*sv;
      }
      /* хвостовой винт */
      vec2 td=(sp-(uSpecial.xy+vec2(.055,-.018)))*vec2(1.78,1.);
      float tr=length(td);
      if(tr<.026){
        float ta=atan(td.y,td.x);
        float tb=pow(abs(cos(ta*1.5-uT*46.)),2.);
        float tdisc=smoothstep(.024,.005,tr);
        c+=vec3(.72,.8,.76)*tdisc*tb*.34*sv;
      }
      /* мигающий красный навигационный огонь на корпусе Ми-24 */
      vec2 nd=(sp-(uSpecial.xy+vec2(.006,-.036)))*vec2(1.78,1.);
      float nc=fract(uT*.85);
      float nb=smoothstep(0.,.05,nc)*(1.-smoothstep(.08,.22,nc));
      c+=vec3(1.,.18,.1)*exp(-dot(nd,nd)/.000045)*1.2*nb*sv;
    }else if(stype<2.5){
      /* Учёные: живая аномалия «Электра» — пульсирующее ядро и трещащие молнии */
      vec2 ed=(sp-uSpecial.xy)*vec2(1.78,1.);
      float er=length(ed);
      if(er<uSpecial.z*1.7){
        float ea=atan(ed.y,ed.x);
        float pulse=.75+.25*sin(uT*5.5)+.2*noise(vec2(uT*18.,2.1));
        float coreE=exp(-er*er/(uSpecial.z*uSpecial.z*.08))*pulse;
        float arcA=abs(sin(ea*3.+noise(vec2(er*22.,floor(uT*14.)*3.1))*5.5));
        float arcB=abs(sin(ea*4.-noise(vec2(er*18.,floor(uT*11.+2.)*4.7))*6.2));
        float bolt=(smoothstep(.09,0.,arcA)+smoothstep(.07,0.,arcB)*.8)*smoothstep(uSpecial.z*1.35,.01,er)*smoothstep(.01,.05,er);
        float snap=step(.35,noise(vec2(uT*16.,ea)));
        c+=vec3(.32,.92,1.)*(coreE*.62+bolt*(.45+.55*snap)*.65)*sv;
      }
      /* отражение вспышек Электры в болотной воде */
      if(sp.y<uWater.x){
        float rx=abs(sp.x-uSpecial.x);
        float refE=exp(-rx*rx/.0035)*smoothstep(uWater.x,uWater.x-.35,sp.y)*(.6+.4*sin(uT*11.+sp.y*40.));
        c+=vec3(.2,.82,1.)*refE*.18*sv;
      }
    }else if(stype<3.5){
      /* Монолит: пульсирующее ядро выброса за ЧАЭС + вспышки молний в тучах */
      vec2 md=(sp-uSpecial.xy)*vec2(1.78,1.);
      float mr=length(md);
      float pulse=.78+.22*sin(uT*1.8)+.14*sin(uT*4.7);
      c+=vec3(1.,.64,.24)*exp(-mr*mr/(uSpecial.z*uSpecial.z*.45))*.28*pulse*sv;
      /* периодические вспышки молний слева и справа в штормовых облаках */
      float fL=pow(max(0.,sin(uT*1.3+noise(vec2(floor(uT*.7),1.3))*6.)),18.);
      float fR=pow(max(0.,sin(uT*1.1+2.5+noise(vec2(floor(uT*.6+3.),4.1))*6.)),20.);
      float gL=exp(-dot((sp-vec2(.22,.58))*vec2(1.78,1.),(sp-vec2(.22,.58))*vec2(1.78,1.))/.022);
      float gR=exp(-dot((sp-vec2(.77,.56))*vec2(1.78,1.),(sp-vec2(.77,.56))*vec2(1.78,1.))/.022);
      c+=vec3(.78,.52,1.)*(gL*fL+gR*fR)*.72*sv;
    }else if(stype<4.5){
      /* Долг: поднимающийся дым из заводских труб на фоне багрового заката */
      vec2 sd=sp-uSpecial.xy;
      if(sd.y>-.06&&sd.y<.34&&abs(sd.x)<.24){
        float plume=smoothstep(-.04,.06,sd.y)*(1.-smoothstep(.16,.32,sd.y))
          *exp(-pow((sd.x+sd.y*.42)/.065,2.));
        float sn=fbm(vec2(sp.x*11.+uT*.28,sp.y*12.-uT*.35));
        c=mix(c,vec3(.07,.04,.05),plume*smoothstep(.3,.82,sn)*.48*sv);
      }
    }else if(stype<5.5){
      /* Ренегаты: мистическое зелёное свечение болотной аномалии и отблеск в воде */
      vec2 gd=(sp-uSpecial.xy)*vec2(1.78,1.);
      float gp=.72+.28*sin(uT*2.2)+.15*sin(uT*5.4);
      float gg=exp(-dot(gd,gd)/(uSpecial.z*uSpecial.z*.55))*gp;
      c+=vec3(.16,1.,.48)*gg*.34*sv;
      if(sp.y<uWater.x){
        float rx=abs(sp.x-uSpecial.x);
        float rw=exp(-rx*rx/.0028)*smoothstep(uWater.x,uWater.x-.32,sp.y)*gp;
        c+=vec3(.14,.92,.46)*rw*.16*sv;
      }
    }else{
      /* Рассвет и Чистое небо: плавно летящие силуэты птиц в рассветном небе */
      for(int b=0;b<2;b++){
        float fb=float(b);
        vec2 bp=vec2(fract(uSpecial.x-uT*(.012+fb*.004)+fb*.31),uSpecial.y+.04*sin(uT*.7+fb*3.)+fb*.04);
        vec2 bd=(sp-bp)*vec2(1.78,1.);
        if(abs(bd.x)<.025&&abs(bd.y)<.018){
          float flap=sin(uT*(5.5+fb*1.4)+fb*2.)*.0045;
          float wy=abs(bd.y-(abs(bd.x)*(.28+flap*22.)-bd.x*bd.x*8.));
          float bird=smoothstep(.0024,.0007,wy)*smoothstep(.022,.004,abs(bd.x));
          c=mix(c,vec3(.08,.1,.14),bird*.65*sv);
        }
      }
    }
  }

  /* 11. Солнечная/лунная дорожка на воде */
  if(uWater.w>=0.&&sp.y<uWater.x&&uWater.y>.05){
    float rx=abs(sp.x-uWater.w);
    float shim=pow(max(0.,sin(sp.y*150.+uT*2.2+noise(sp*vec2(26.,42.)+uT*.5)*6.)),3.);
    float colW=exp(-rx*rx/.0032)*smoothstep(uWater.x,uWater.x-.28,sp.y);
    c+=mix(vec3(1.,.82,.5),uAcc2,.25)*colW*shim*.22*sv;
  }

  /* 12. Цвета аномалии */
  c=mix(c,c*.76+uAcc*.48,core*.55);
  c+=uAcc*(ring*.32+core*.42);

  /* 13. Объёмный туман в глубине и низовой дым */
  vec3 fogc=mix(vec3(.56,.6,.66),uAcc,.22+uFlash*.5)*(1.+uFlash);
  float fn=fbm(vec2(s.x*2.4+uT*.035,s.y*5.-uT*.012)+cam*4.);
  float band=smoothstep(.12,.58,1.-d)*smoothstep(.12,.34,p.y)*(1.-smoothstep(.56,.74,p.y));
  c=mix(c,fogc*(.55+.45*fn),band*fn*.36*uAtmos.x);
  vec2 fq=vec2(s.x*3.2+uT*.05,s.y*7.)+cam*6.;
  float gn=fbm(fq+noise(fq*.5+uT*.03)*1.4);
  c=mix(c,fogc*.82,smoothstep(.4,.05,s.y)*smoothstep(.42,.9,gn)*.25*uAtmos.x);

  /* 14. Затемнение и виньетка (как в CSS-фоне body::before для читаемости карточек) */
  float t=1.-s.y,dm=t<.3?mix(uDim+.1,uDim,t/.3):t<.7?mix(uDim,uDim+.15,(t-.3)/.4):mix(uDim+.15,1.,(t-.7)/.3);
  c=mix(c,vec3(.016,.024,.031),clamp(dm,0.,1.));
  c*=1.-clamp((length(vec2((s.x-.5)/1.2,(t-.4)/.9))-.55)/.45,0.,1.)*.55;

  /* 15. Пыль и пепел в трёх слоях параллакса */
  vec2 m1=motes(s+cam*.65,9.,.028,.045,1.,.05),m2=motes(s+cam*.38,16.,.022,.036,5.,.06),m3=motes(s+cam*.16,28.,.018,.026,9.,.08);
  float far=smoothstep(.5,.3,d);
  float fl=(1.+uFlash*1.5)*uAtmos.y;
  c+=vec3(.95,.88,.75)*(m1.x*.3+m2.x*.2+m3.x*.13*far)*fl;
  c+=(uAcc*1.3+.15)*(m1.y*.48+m2.y*.38+m3.y*.26*far)*fl;

  /* 16. Искры случайной аномалии */
  if(uAnom.z>=0.){
    float st=(uAnom.z-.06)/.55;
    if(st>0.&&st<1.){
      float e=1.-pow(1.-st,3.),spA=0.;vec2 o=uAnom.xy*vec2(ar,1.),q=s*vec2(ar,1.);
      for(int i=0;i<${SPARKS};i++){
        float fi=float(i),an=hash(vec2(fi,uAnom.x*91.))*6.2832,v=.4+hash(vec2(fi+7.,uAnom.y*53.));
        vec2 dv=q-o-vec2(cos(an),sin(an)*.8)*v*e*.2-vec2(0.,-st*st*.06);
        float sz=(.0025+v*.002)*(1.-st*.6);
        spA+=exp(-dot(dv,dv)/(sz*sz))*(.6+.4*sin(st*40.+v*30.));
      }
      c+=(uAcc2*1.4+.2)*spA*(1.-st);
    }
  }
  c+=(hash(s*uRes+fract(uT)*91.)-.5)*.015;
  gl_FragColor=vec4(c,1.);
}`;

export function startBackground() {
  const canvas = document.createElement("canvas");
  canvas.className = "zone-bg";
  canvas.setAttribute("aria-hidden", "true");
  let gl;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "low-power" });
  } catch (e) {
    gl = null;
  }
  if (!gl) return null;

  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererStr = String(
    (dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ""
  );
  const swGl = /SwiftShader|llvmpipe|Software|Basic Render/i.test(rendererStr);
  const fragSrc = buildFrag(swGl ? 2 : lowPower ? 3 : 4, swGl || lowPower ? 4 : 8, swGl ? 14 : lowPower ? 20 : 34);

  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
    return s;
  };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fragSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
  } catch (e) {
    console.warn("Фон главной: шейдер не собрался", e);
    return null;
  }
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  [
    "uPhoto",
    "uPhoto2",
    "uDepth",
    "uDepth2",
    "uRes",
    "uMouse",
    "uCrop",
    "uT",
    "uAspect",
    "uDim",
    "uMix",
    "uFlash",
    "uSceneVis",
    "uAcc",
    "uAcc2",
    "uAnom",
    "uSky",
    "uWater",
    "uAtmos",
    "uSpecial",
    "uFires",
    "uFlags",
    "uFlagDir",
    "uBeams",
    "uBeamOpt",
    "uLights"
  ].forEach(n => (U[n] = gl.getUniformLocation(prog, n)));

  gl.uniform1i(U.uPhoto, 0);
  gl.uniform1i(U.uPhoto2, 1);
  gl.uniform1i(U.uDepth, 2);
  gl.uniform1i(U.uDepth2, 3);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  function bindTex(unit, t) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  }
  const makeTex = (unit, px) => {
    const t = gl.createTexture();
    bindTex(unit, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(px));
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };
  const upload = (unit, t, img) => {
    bindTex(unit, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  };

  const FLAT = [88, 88, 88];
  let cur = { photo: makeTex(0, [4, 6, 8]), depth: makeTex(2, FLAT) };
  let next = { photo: makeTex(1, [4, 6, 8]), depth: makeTex(3, FLAT) };
  const bindSet = () => {
    bindTex(0, cur.photo);
    bindTex(2, cur.depth);
    bindTex(1, next.photo);
    bindTex(3, next.depth);
  };
  document.body.prepend(canvas);

  const applySceneUniforms = (key, bgUrl) => {
    const mob = /-m\.webp/i.test(bgUrl || "");
    const p = packSceneUniforms(key, mob);
    gl.uniform2fv(U.uCrop, p.crop);
    gl.uniform4fv(U.uSky, p.sky);
    gl.uniform4fv(U.uWater, p.water);
    gl.uniform4fv(U.uAtmos, p.atmos);
    gl.uniform4fv(U.uSpecial, p.special);
    gl.uniform4fv(U.uFires, p.fires);
    gl.uniform4fv(U.uFlags, p.flags);
    gl.uniform4fv(U.uFlagDir, p.flagDir);
    gl.uniform4fv(U.uBeams, p.beams);
    gl.uniform4fv(U.uBeamOpt, p.beamOpt);
    gl.uniform4fv(U.uLights, p.lights);
  };

  let theme = readTheme();
  const setThemeColors = t => {
    gl.uniform3fv(U.uAcc, t.accent);
    gl.uniform3fv(U.uAcc2, t.accent2);
    gl.uniform1f(U.uDim, t.dim);
  };
  setThemeColors(theme);
  applySceneUniforms(theme.key, theme.bg);
  gl.uniform1f(U.uSceneVis, 1);

  const loadImg = url =>
    new Promise(ok => {
      if (!url) return ok(null);
      const img = new Image();
      img.decoding = "async";
      img.onload = () => ok(img);
      img.onerror = () => ok(null);
      img.src = url;
    });

  let aspect = 16 / 9;
  let fade = null;
  let loading = 0;

  function loadBg(t, first) {
    const id = ++loading;
    Promise.all([loadImg(t.bg), loadImg(t.depth)]).then(([img, dimg]) => {
      if (id !== loading || dead || !img) return;
      wake();
      const set = first ? cur : next;
      upload(first ? 0 : 1, set.photo, img);
      if (dimg) upload(first ? 2 : 3, set.depth, dimg);
      else {
        bindTex(first ? 2 : 3, set.depth);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(FLAT));
      }
      aspect = img.width / img.height;
      if (first) {
        applySceneUniforms(t.key, t.bg);
        requestAnimationFrame(() => canvas.classList.add("on"));
      } else {
        fade = { t0: performance.now(), key: t.key, bg: t.bg, swapped: false };
      }
    });
  }

  function syncTheme() {
    const t = readTheme();
    if (t.key === theme.key && t.bg === theme.bg && t.depth === theme.depth) return;
    theme = t;
    setThemeColors(t);
    loadBg(t, false);
  }
  loadBg(theme, true);
  new MutationObserver(() => requestAnimationFrame(syncTheme)).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });

  let W = 1;
  let H = 1;
  const maxPx = swGl ? 0.5 : Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5);
  let px = maxPx;

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width || window.innerWidth));
    H = Math.max(1, Math.round(r.height || window.innerHeight));
    canvas.width = Math.max(1, Math.round(W * px));
    canvas.height = Math.max(1, Math.round(H * px));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    syncTheme();
  }
  resize();
  window.addEventListener("resize", resize);
  const reflow = () => {
    resize();
    wake();
    setTimeout(resize, 350);
  };
  window.addEventListener("orientationchange", reflow);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener("change", reflow);
  if (window.ResizeObserver)
    new ResizeObserver(() => {
      resize();
      wake();
    }).observe(canvas);

  /* мышь и наклон телефона */
  const target = { x: 0, y: 0 };
  const view = { x: 0, y: 0 };
  const setTarget = (x, y) => {
    target.x = x;
    target.y = y;
  };
  let lastInput = 0;
  window.addEventListener(
    "pointermove",
    e => {
      if (e.pointerType !== "mouse") return;
      setTarget((e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1);
      lastInput = performance.now();
    },
    { passive: true }
  );

  let base = null;
  const cl = v => Math.max(-1, Math.min(1, v));
  const angle = () => {
    const so = screen.orientation;
    if (so && typeof so.angle === "number") return so.angle;
    return typeof window.orientation === "number" ? window.orientation : 0;
  };
  function onTilt(e) {
    if (e.gamma == null || e.beta == null) return;
    const a = ((angle() % 360) + 360) % 360;
    const x = a === 90 ? e.beta : a === 270 ? -e.beta : a === 180 ? -e.gamma : e.gamma;
    const y = a === 90 ? -e.gamma : a === 270 ? e.gamma : a === 180 ? -e.beta : e.beta;
    if (!base) base = { x, y };
    setTarget(cl((x - base.x) / 22), cl((y - base.y) / 22));
    lastInput = performance.now();
  }
  const resetBase = () => {
    base = null;
  };
  const resetBaseSoon = () => {
    resetBase();
    setTimeout(resetBase, 400);
  };
  window.addEventListener("orientationchange", resetBaseSoon);
  if (screen.orientation && screen.orientation.addEventListener)
    screen.orientation.addEventListener("change", resetBaseSoon);
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    let busy = false;
    const stop = () => {
      window.removeEventListener("touchend", ask, true);
      window.removeEventListener("click", ask, true);
    };
    const ask = () => {
      if (busy) return;
      busy = true;
      DOE.requestPermission()
        .then(r => {
          stop();
          if (r === "granted") window.addEventListener("deviceorientation", onTilt, { passive: true });
        })
        .catch(() => {
          busy = false;
        });
    };
    window.addEventListener("touchend", ask, true);
    window.addEventListener("click", ask, true);
  } else window.addEventListener("deviceorientation", onTilt, { passive: true });

  let touch0 = null;
  window.addEventListener(
    "touchstart",
    e => {
      const t = e.touches[0];
      touch0 = { x: t.clientX, y: t.clientY, tx: target.x, ty: target.y };
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    e => {
      if (!touch0 || base) return;
      const t = e.touches[0];
      setTarget(cl(touch0.tx + ((t.clientX - touch0.x) / W) * 1.4), cl(touch0.ty + ((t.clientY - touch0.y) / H) * 1.4));
      lastInput = performance.now();
    },
    { passive: true }
  );

  /* случайная аномалия: реже и аккуратнее, чтобы не перебивать собственные эффекты локации */
  let anom = null;
  let nextAnom = performance.now() + 5500 + Math.random() * 4500;
  function spawnAnomaly(now) {
    anom = { t0: now, dur: 2200, x: 0.16 + Math.random() * 0.68, y: 1 - (0.2 + Math.random() * 0.42) };
    nextAnom = now + 9000 + Math.random() * 8000;
  }

  const FPS = swGl ? 4 : 30;
  const FRAME_MS = 1000 / FPS;
  const IDLE_STOP_MS = 22000;
  const LOOP_S = 1800;
  let t0 = performance.now();
  let raf = 0;
  let swTimer = 0;
  let lastFrame = 0;
  let lastActive = t0;
  let pausedAt = 0;
  let slowFrames = 0;
  let dead = false;

  const stopLoop = () => {
    if (raf) cancelAnimationFrame(raf);
    if (swTimer) clearTimeout(swTimer);
    raf = 0;
    swTimer = 0;
  };
  const scheduleNext = () => {
    if (swGl) {
      swTimer = setTimeout(() => {
        swTimer = 0;
        if (!document.hidden && !dead) raf = requestAnimationFrame(frame);
      }, FRAME_MS);
    } else {
      raf = requestAnimationFrame(frame);
    }
  };

  function wake() {
    lastActive = performance.now();
    if (document.hidden || raf || swTimer || dead) return;
    if (pausedAt) {
      const d = lastActive - pausedAt;
      t0 += d;
      nextAnom += d;
      pausedAt = 0;
    }
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf || swTimer) {
        stopLoop();
        pausedAt = performance.now();
      }
    } else wake();
  });
  ["pointermove", "pointerdown", "wheel", "scroll", "keydown", "touchstart"].forEach(ev =>
    window.addEventListener(ev, wake, { passive: true })
  );

  function frame() {
    raf = 0;
    if (document.hidden) {
      pausedAt = performance.now();
      return;
    }
    const now = performance.now();
    if (now - lastActive > IDLE_STOP_MS && !anom && !fade) {
      pausedAt = now;
      return;
    }
    if (!swGl && now - lastFrame < FRAME_MS - 2) {
      raf = requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;
    const drawStart = performance.now();
    const time = ((now - t0) / 1000) % LOOP_S;

    const idle = now - lastInput > 4000;
    const amp = isMobile ? 1.45 : 1;
    const tx = idle ? Math.sin(time * 0.14) * 0.34 * amp : target.x;
    const ty = idle ? Math.sin(time * 0.1) * 0.22 * amp : target.y;
    view.x += (tx - view.x) * 0.055;
    view.y += (ty - view.y) * 0.055;

    if (now > nextAnom && !anom) spawnAnomaly(now);
    let ak = -1;
    let flash = 0;
    if (anom) {
      ak = (now - anom.t0) / anom.dur;
      if (ak >= 1) {
        anom = null;
        ak = -1;
      } else flash = Math.max(0, Math.sin(ak * Math.PI)) * 0.3 * (1 + 0.45 * Math.sin(now * 0.05));
    }

    let mix = 0;
    let sceneVis = 1;
    if (fade) {
      mix = Math.min(1, (now - fade.t0) / 900);
      if (mix < 0.5) {
        sceneVis = 1 - mix * 2;
      } else {
        if (!fade.swapped) {
          applySceneUniforms(fade.key, fade.bg);
          fade.swapped = true;
        }
        sceneVis = (mix - 0.5) * 2;
      }
      if (mix >= 1) {
        [cur, next] = [next, cur];
        bindSet();
        mix = 0;
        sceneVis = 1;
        fade = null;
      }
    }

    gl.uniform1f(U.uT, time);
    gl.uniform2f(U.uMouse, view.x, -view.y);
    gl.uniform1f(U.uAspect, aspect);
    gl.uniform1f(U.uMix, mix);
    gl.uniform1f(U.uFlash, flash);
    gl.uniform1f(U.uSceneVis, sceneVis);
    gl.uniform3f(U.uAnom, anom ? anom.x : 0, anom ? anom.y : 0, ak);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!swGl && px > 0.75 && performance.now() - drawStart > 28) {
      if (++slowFrames >= 8) {
        px = Math.max(0.75, px - 0.25);
        slowFrames = 0;
        resize();
      }
    } else slowFrames = 0;
    scheduleNext();
  }

  if (!document.hidden) raf = requestAnimationFrame(frame);
  window.addEventListener("resize", wake);
  new MutationObserver(wake).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  canvas.addEventListener("webglcontextlost", e => {
    e.preventDefault();
    dead = true;
    stopLoop();
    canvas.classList.remove("on");
  });
  return { canvas, spawnAnomaly: () => spawnAnomaly(performance.now()) };
}
