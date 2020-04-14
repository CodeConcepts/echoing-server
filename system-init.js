const schema = require('./models');

function SystemInit() {
    let self = this;

    self.initUser();

    return self;
}

SystemInit.prototype.initUser = function() {
    schema.User.countDocuments({ role: 'sysadmin' }, function (err, count) {
        if (err) {
            console.log("ERROR: System Init : User : " + err);
            process.exit(0);
        }

        if(count === 0) {
            let superUser = new schema.User({
                username: "echoadmin",
                forename: "The",
                surname: "Administrator",
                emailAddress: "admin@echoing.io",
                hash_password: "password",
                role: "sysadmin",
                updated: new Date(),
                active: true
            });
            superUser.save(function (err) {
                if (err) {
                    console.log("ERROR: System Init : User : " + err);
                    process.exit(0);
                }

                console.log("Super user created new with username: \"echoadmin\" and password: \"password\".");
            });
        }
    });
};

module.exports = SystemInit;
