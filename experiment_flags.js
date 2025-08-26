window.PLANVILLE_FLAGS = (function(){
  const flags = { EXPRESS_VISIBLE: true, FEATURE_SCHEDULE: false, FEATURE_B2B: true };
  return {
    get(k){ return flags[k]; },
    set(k,v){ flags[k]=v; },
    all(){ return Object.assign({}, flags); }
  };
})();