const extend = require('util')._extend;
const path = require('path');
const fs = require('fs');
const appRoot = require('app-root-path');
const moment = require('moment');

// Load the app config file
const pjson = require('../../app.config.json');

class Mixer {
  mixers = {};

  // The constructor
  constructor() {
    let self = this;

    // Load the mixers into 
    for(let i = 0; i < pjson.echoing.mixers; i++) {
      let mixer = pjson.echoing.mixers[i];
      self.mixers[mixer.id] = require(mixer.requires);
    }
    
    return self;
  }

  // This function executes the mixer with the supplied parameters 
  async mix(id, params) {
    return this.mixers[id](params);
  }
}

export default Mixer;