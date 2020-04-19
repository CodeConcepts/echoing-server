//const schema = require('../../models');

module.exports = function authenticate(authObject) {
    // This method is used to authenticate the current user against the
    // authObject.

    function checkUserAccess(authObject, user, next) {
        // if no user auth object, move to the next permission check.
        if(!authObject.user) return next();

        // Check different if the current user should be allowed to access this user.
        if(authObject.user && authObject.user._id === user._id) return next();
        next(new Error("User Level Access Denied."));
    }

    return function(req, res, next) {
        // Nothing to check, just pass.
        if(!authObject) return next();

        // If the user is a sysadmin user, lets just let them do anything :)
        if(req.user.role === 'sysadmin') return next();

        // If we have a authObject, we need to be logged in
        if(authObject && !req.user) return res.send(401, "Unauthorised: You need to login first.");

        // Check if we need to be a specific role
        if(authObject.roles)
        {
            if(typeof authObject.roles == 'string' && req.user.role !== authObject.roles) return res.send(401, "Unauthorised: You do not have the correct role (1).");
            else if(Array.isArray(authObject.roles) && authObject.roles.indexOf(req.user.role) === -1) return res.status(401).send("Unauthorised: You do not have the correct role (2).");
            //else return next(new Error("Unknown roles type passed in authenticate object, it must be either a string or an array of strings."));
        }

        // Lets loop through the authObject and extract all param items.
        Object.keys(authObject).forEach(function(key){
            if(typeof authObject[key] == 'object' && !Array.isArray(authObject[key])) {
                if (authObject[key].param && authObject[key].param === "id") authObject[key]._id = req.params[authObject[key].param];
                else authObject[key][authObject[key].param] = req.params[authObject[key].param];
            }
        });

        // Lets loop through the authObject and extract all body items.
        Object.keys(authObject).forEach(function(key){
            if(typeof authObject[key] == 'object' && !Array.isArray(authObject[key])) {
                if (authObject[key].body && authObject[key].body === "id") authObject[key]._id = req.body[authObject[key].body];
                else authObject[key][authObject[key].body] = req.body[authObject[key].body];
            }
        });

        checkUserAccess(authObject, req.user, function(err) {
            if(err) return res.send(401, "Unauthorised: " + err.message);
            return next();
        });
    };
};
