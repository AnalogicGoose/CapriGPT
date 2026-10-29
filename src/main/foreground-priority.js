'use strict';
// Reserve priority before awaiting cancellation so a new desktop event cannot
// take the local model between routing a user message and generating its reply.
class ForegroundPriority {
  constructor(background) { this.background=background;this.active=0; }
  async run(work) {
    this.active++;
    try {
      const agent=this.background();
      if(agent.busy&&agent.reason!=='user-request') {
        const done=agent.done;
        agent.cancel();
        await done;
      }
      return await work();
    } finally { this.active--; }
  }
}
module.exports={ForegroundPriority};
