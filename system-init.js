const schema = require('./models');

function SystemInit() {
    let self = this;

    self.initAccount(function(err, account) {
        if(err) {
            console.log(err);
            process.exit(0);
        }

        self.initUser(account);
    });

    return self;
}

SystemInit.prototype.initAccount = function(cb) {
    schema.Account.countDocuments({ name: 'Echoing.io - Root' }, function(err, count) {
        if (err) {
            console.log("ERROR: System Init : Account : " + err);
            process.exit(0);
        }

        if(count == 0) {
            let newAccount = new schema.Account({
                name: 'Echoing.io - Root',
                address: {
                    address1: "1 Echoing Street",
                    city: "Gotham",
                    county: "BUCKS",
                    country: "United Kingdom"
                },
                maxUsers: 999,
                billedUsers: 0,
                userCount: 0,
                billingPeriod: "None"
            });

            newAccount.save(function(err, account) {
                if (err) {
                    console.log("ERROR: System Init : Account : " + err);
                    process.exit(0);
                }

                console.log("Account created new with account name: EchoingRoot");
                return cb(err, account);
            })
        }
    });
};

SystemInit.prototype.initUser = function(account) {
    schema.User.countDocuments({ role: 'sysadmin' }, function (err, count) {
        if (err) {
            console.log("ERROR: System Init : User : " + err);
            process.exit(0);
        }

        if(count === 0) {
            let superUser = new schema.User({
                _account: account._id,
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
