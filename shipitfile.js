// shipitfile.js
module.exports = shipit => {
    // Load shipit-deploy tasks
    require('shipit-deploy')(shipit)
  
    shipit.initConfig({
      default: {
        deployTo: '/home/echoing/echoing-server',
        repositoryUrl: 'https://github.com/CodeConcepts/echoing-server.git',
      },
      production: {
        servers: 'echoing@localhost',
      },
    })
  }