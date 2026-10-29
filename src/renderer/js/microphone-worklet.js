class CapriMicrophone extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Int16Array(1600);this.used=0;
    this.port.onmessage=event=>{if(event.data==='stop'){this.flush();this.port.postMessage({type:'flushed'});}};}
  flush(){if(!this.used)return;const chunk=this.buffer.slice(0,this.used);
    this.port.postMessage({type:'audio',samples:chunk.buffer},[chunk.buffer]);this.used=0;}
  process(inputs){const channel=inputs[0]?.[0];if(!channel)return true;
    for(const value of channel){this.buffer[this.used++]=Math.max(-32768,Math.min(32767,Math.round(value*32767)));
      if(this.used===this.buffer.length)this.flush();}return true;}
}
registerProcessor('capri-microphone',CapriMicrophone);
