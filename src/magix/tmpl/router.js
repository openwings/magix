var WIN=window;
var EMPTY='';
var PATHNAME='pathname';

var Has=Magix.has;
var Mix=Magix.mix;
var D=document;
var IsUtf8=/^UTF-8$/i.test(D.charset||D.characterSet||'UTF-8');
var MxConfig=Magix.config();
var HrefCache=Magix.createCache();
var ChgdCache=Magix.createCache();

var TLoc,LLoc,Pnr;
var TitleC=1<<16;
var TrimHashReg=/#.*$/,TrimQueryReg=/^[^#]*#?!?/;
var Ps='params';
var UseNativeHistory=MxConfig.nativeHistory;
var SupportState,HashAsNativeHistory;

var isParam=function(params,r,ps){
    if(params){
        ps=this[Ps];
        if(!Magix.isArray(params))params=params.split(',');
        for(var i=0;i<params.length;i++){
            r=Has(ps,params[i]);
            if(r)break;
        }
    }
    return r;
};
var isPathname=function(){
    return Has(this,PATHNAME);  
};
var isView=function(){
    return Has(this,'view');
};
/*var isParamChangedExcept=function(args){
    if(Magix.isString(args)){
        args=args.split(',');
    }else if(!Magix.isArray(args)){
        args=[args];
    }
    var temp={};
    for(var i=0;i<args.length;i++){
        temp[args[i]]=true;
    }
    var keys=Magix.keys(this[Ps]);
    for(i=0;i<keys.length;i++){
        if(!Has(temp,keys[i])){
            return true;
        }
    }
    return false;
};*/
var pathnameDiff=function(){
    var me=this;
    var hash=me.hash;
    var query=me.query;
    return hash[PATHNAME]!=query[PATHNAME];
};
var paramDiff=function(param){
    var me=this;
    var hash=me.hash;
    var query=me.query;
    return hash[Ps][param]!=query[Ps][param];
};
var hashOwn=function(key){
    var me=this;
    var hash=me.hash;
    return Has(hash[Ps],key);
};
var queryOwn=function(key){
    var me=this;
    var query=me.query;
    return Has(query[Ps],key);
};

var getParam=function(key){
    var me=this;
    var params=me[Ps];
    return params[key];
};


//var PathTrimFileParamsReg=/(\/)?[^\/]*[=#]$/;//).replace(,'$1').replace(,EMPTY);
//var PathTrimSearch=/\?.*$/;
/**
 * @name Router
 * @namespace
 * @borrows Event.on as on
 * @borrows Event.fire as fire
 * @borrows Event.un as un
 */
var Router=Mix({
    /**
     * @lends Router
     */
    /**
     * 使用history state做为改变url的方式来保存当前页面的状态
     * @function
     */
    useState:Magix.unimpl,
    /**
     * 使用hash做为改变url的方式来保存当前页面的状态
     * @function
     */
    useHash:Magix.unimpl,
    /**
     * 根据地址栏中的pathname获取对应的前端view
     * @param  {String} pathname 形如/list/index这样的pathname
     * @return {String} 返回形如app/views/layouts/index这样的字符串
     */
    getView:function(pathname){
        var me=this;
        
        if(!Pnr){
            Pnr={
                routes:MxConfig.routes||{},
                e404:MxConfig.notFoundView
            }
            //var home=pathCfg.defaultView;//处理默认加载的view
            //var dPathname=pathCfg.defaultPathname||EMPTY;
            var defaultView=MxConfig.defaultView;
            if(!defaultView){
                throw new Error('unset defaultView');
            }
            Pnr.home=defaultView;
            var defaultPathname=MxConfig.defaultPathname||EMPTY;
            //if(!Magix.isFunction(temp.routes)){
            Pnr.routes[defaultPathname]=defaultView;
            Pnr[PATHNAME]=defaultPathname;
        }

        var result;

        if(!pathname)pathname=Pnr[PATHNAME];
        //console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',pathname);
        var r=Pnr.routes;
        if(Magix.isFunction(r)){
            result=r.call(MxConfig,pathname);
        }else{
            result=r[pathname];//简单的在映射表中找
        }

        return {
            view:result?result:Pnr.e404||Pnr.home,
            pathname:result?pathname:(Pnr.e404?pathname:Pnr[PATHNAME])
        }
    },
    /**
     * 开始路由工作
     * @private
     */
    start:function(){
        var me=this;
        var H=WIN.history;

        SupportState=UseNativeHistory&&H.pushState;
        HashAsNativeHistory=UseNativeHistory&&!SupportState;

        if(SupportState){
            me.useState();
        }else{
            me.useHash();
        }
        me.route();//页面首次加载，初始化整个页面
    },
    /**
     * 解析path
     * @param  {String} path /a/b/c?a=b&c=d的字符串
     * @return {Object}
     * @private
     */
    path:function(path){
        var o=Magix.pathToObject(path,IsUtf8);
        var pn=o[PATHNAME];
        var me=this;
        if(pn&&HashAsNativeHistory){//如果不是以/开头的并且要使用history state,当前浏览器又不支持history state则放hash中的pathname要进行处理
            o[PATHNAME]=Magix.path(WIN.location[PATHNAME],pn);
        }        
        return o;
    },
    /**
     * 解析href的query和hash，默认href为window.location.href
     * @param {String} [href] href
     * @param {Boolean} [attachViewInfo] 是否附加对应的前端view信息
     * @return {Object} 解析的对象
     */
    parseQH:function(href,attachViewInfo){
        href=href||WIN.location.href;

        var me=this;
        /*var cfg=Magix.config();
        if(!cfg.originalHREF){
            try{
                href=DECODE(href);//解码有问题 http://fashion.s.etao.com/search?q=%CF%CA%BB%A8&initiative_id=setao_20120529&tbpm=t => error:URIError: malformed URI sequence
            }catch(ignore){

            }
        }*/
        var result=HrefCache.get(href);
        if(!result){
            var query=href.replace(TrimHashReg,EMPTY);
            //console.log(params);
            //var query=tPathname+params.replace(/^([^#]+).*$/g,'$1');
            var hash=href.replace(TrimQueryReg,EMPTY);//原始hash
            //console.log(params,'--',href,'---',hash,'--',query);
            var queryObj=me.path(query);
            //console.log(hash,'___________________',hash.replace(/^!?/,EMPTY));
            var hashObj=me.path(hash);//去掉可能的！开始符号
            //console.log(hashObj.pathname,'hhhhhhhhhhhhhhhhhhhhhhhhh');
            var comObj={};//把query和hash解析的参数进行合并，用于hash和pushState之间的过度
            Mix(comObj,queryObj[Ps]);
            Mix(comObj,hashObj[Ps]);
            result={
                pathnameDiff:pathnameDiff,
                paramDiff:paramDiff,
                hashOwn:hashOwn,
                queryOwn:queryOwn,
                get:getParam,
                href:href,
                srcQuery:query,
                srcHash:hash,
                query:queryObj,
                hash:hashObj,
                params:comObj
            }
            HrefCache.set(href,result);
        }
        if(attachViewInfo&&!result.view){
            //console.log(result,result.srcHash);
            var tempPathname;
            /*
                1.在选择pathname时，不能简单的把hash中的覆盖query中的。有可能是从不支持history state浏览器上拷贝链接到支持的浏览器上，分情况而定：
                如果hash中存在pathname则使用hash中的，否则用query中的

                2.如果指定不用history state则直接使用hash中的pathname
                
                以下是对第1条带hash的讨论
                // http://etao.com/list/?a=b#!/home?page=2&rows=20
                //  /list/index
                //  /home 
                //   http://etao.com/list?page=3#!/home?page=2;
                // 情形A. pathname不变 http://etao.com/list?page=3#!/list?page=2 到支持history state的浏览器上 参数合并;
                // 情形B .pathname有变化 http://etao.com/list?page=3#!/home?page=2 到支持history state的浏览器上 参数合并,pathname以hash中的为准;
            */
            if(UseNativeHistory){//指定使用history state
                /*
                if(me.supportState()){//当前浏览器也支持
                    if(hashObj[PATHNAME]){//优先使用hash中的，理由见上1
                        tempPathname=hashObj[PATHNAME];
                    }else{
                        tempPathname=queryObj[PATHNAME];
                    }
                }else{//指定使用history 但浏览器不支持 说明服务器支持这个路径，规则同上
                    if(hashObj[PATHNAME]){//优先使用hash中的，理由见上1
                        tempPathname=hashObj[PATHNAME];
                    }else{
                        tempPathname=queryObj[PATHNAME];
                    }
                }
                合并后如下：
                */
                //console.log(result.hash.pathname,';;;;;;;;;;;;;;;;;');
                tempPathname=result.hash[PATHNAME]||result.query[PATHNAME];
            }else{//指定不用history state ，那咱还能说什么呢，直接用hash
                tempPathname=result.hash[PATHNAME];
            }
            var view=me.getView(tempPathname);
            Mix(result,view);
        }
        return result;
    },
    /**
     * 获取2个location对象之间的差异部分
     * @param  {Object} oldLocation 原始的location对象
     * @param  {Object} newLocation 当前的location对象
     * @return {Object} 返回包含差异信息的对象
     * @private
     */
    getChged:function(oldLocation,newLocation){
        var oKey=oldLocation.href;
        var nKey=newLocation.href;
        var tKey=oKey+'\n'+nKey;
        var result=ChgdCache.get(tKey);
        if(!result){
            tKey=nKey+'\n'+tKey;
            result=ChgdCache.get(tKey);
        }
        if(!result){
            var hasChanged;
            result={params:{}};
            if(oldLocation[PATHNAME]!=newLocation[PATHNAME]){
                result[PATHNAME]=1;
                hasChanged=1;
            }
            if(oldLocation.view!=newLocation.view){
                result.view=1;
                hasChanged=1;
            }
            var oldParams=oldLocation[Ps],newParams=newLocation[Ps];
            var p;
            for(p in oldParams){
                if(oldParams[p]!=newParams[p]){
                    hasChanged=1;
                    result[Ps][p]=1;
                }
            }

            for(p in newParams){
                if(oldParams[p]!=newParams[p]){
                    hasChanged=1;
                    result[Ps][p]=1;
                }
            }
            result.occur=hasChanged;
            result.isParam=isParam;
            result.isPathname=isPathname;
            result.isView=isView;
            ChgdCache.set(tKey,result);
        }
        return result;
    },
    /**
     * 根据window.location.href路由并派发相应的事件
     */
    route:function(){
        var me=this;
        var location=me.parseQH(0,1);
        var oldLocation=LLoc||{params:{},href:'~'};
        var firstFire=!LLoc;//是否强制触发的changed，对于首次加载会强制触发一次

        LLoc=location;

        var fire;
        var changed=me.getChged(oldLocation,location);
        if(changed.occur){
            TLoc=location;
            me.fire('changed',{
                location:location,
                changed:changed,
                force:firstFire
            });
        }
    },
    /**
     * 根据参数进行有选择的导航
     * @param  {Object|String} pn pathname或参数字符串或参数对象
     * @param {String|Object} [params] 参数对象
     * @example
     * KISSY.use('magix/router',function(S,R){
     *      R.navigate('/list?page=2&rows=20');//改变pathname和相关的参数，地址栏上的其它参数会进行丢弃，不会保留
     *      R.navigate('page=2&rows=20');//只修改参数，地址栏上的其它参数会保留
     *      R.navigate({//通过对象修改参数，地址栏上的其它参数会保留
     *          page:2,
     *          rows:20
     *      });
     *      R.navigate('/list',{
     *          page:2,
     *          rows:20
     *      })
     * });
     */
    /*
        1.
            render:function(){
                console.log(this.location)
            },
            events:{
                click:{
                    changeHash:function(e){
                        Router.navigate('a='+S.now());
                        Router.navigate('b='+S.now());
                        e.view.render();
                    }
                }
            }
     */
    navigate:function(pn,params){
        var me=this;
        
        if(!params&&Magix.isObject(pn)){
            params=pn;
            pn=EMPTY;
        }
        if(params){
            pn=Magix.objectToPath({
                params:params,
                pathname:pn
            },IsUtf8)
        }
        //TLoc引用
        //pathObj引用
        //
        //temp={params:{},pathname:{}}
        //
        //Mix(temp,TLoc,temp);
        //
        //

        if(pn){

            var pathObj=me.path(pn);
            var temp={};
            temp[Ps]=Mix({},pathObj[Ps]);
            temp[PATHNAME]=pathObj[PATHNAME];

            if(temp[PATHNAME]){
                if(HashAsNativeHistory){//指定使用history state但浏览器不支持，需要把query中的存在的参数以空格替换掉
                    var query=TLoc.query;
                    if(query&&(query=query[Ps])){
                        for(var p in query){
                            if(Has(query,p)&&!Has(temp[Ps],p)){
                                temp[Ps][p]=EMPTY;
                            }
                        }
                    }
                }
            }else{
                var ps=Mix({},TLoc[Ps]);
                temp[Ps]=Mix(ps,temp[Ps]);
                temp[PATHNAME]=TLoc[PATHNAME];
            }
            var tempPath=Magix.objectToPath(temp);

            var navigate;

            if(SupportState){
                navigate=tempPath!=TLoc.srcQuery;
            }else{
                navigate=tempPath!=TLoc.srcHash;
            }

            if(navigate){
                
                if(SupportState){//如果使用pushState
                    me.popFired=1;
                    history.pushState(TitleC--,D.title,tempPath);
                    me.route();
                }else{
                    Mix(temp,TLoc,temp);
                    temp.srcHash=tempPath;
                    temp.hash={
                        params:temp[Ps],
                        pathname:temp[PATHNAME]
                    };
                    /*
                        window.onhashchange=function(e){
                            console.log('----',location.hash,e);
                        };
                        (function(){
                            location.hash='a';
                            location.hash='b';
                            location.hash='c';
                        }());
                        

                     */
                    me.fire('changed',{loc:TLoc=temp});
                    location.hash='#!'+tempPath;
                }
            }
        }
    }
    
    /**
     * 当window.location.href有改变化时触发
     * @name Router.changed 
     * @event 
     * @param {Object} e 事件对象
     * @param {Object} e.location 地址解析出来的对象，包括query hash 以及 query和hash合并出来的params等
     * @param {Object} e.changed 有哪些值发生改变的对象
     * @param {Boolean} e.force 标识是否是第一次强制触发的changed，对于首次加载完Magix，会强制触发一次changed
     */
    
    /**
     * 当window.location.href有改变化时触发（该事件在扩展中实现）
     * @name Router.change 
     * @event 
     * @param {Object} e 事件对象
     * @param {Object} e.location 地址解析出来的对象，包括query hash 以及 query和hash合并出来的params等
     * @param {Function} e.back 回退到变化前的地址上，阻止跳转
     */

},Event);