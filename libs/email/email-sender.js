const extend = require('util')._extend;
const Q = require('q');
const Email = require('email-templates');
const path = require('path');
const fs = require('fs');
const appRoot = require('app-root-path');
const moment = require('moment');

// Load the app config file
const pjson = require('../../app.config.json');

function EmailSender(config) {
    let self = this;

    self.config = extend(pjson.wingnut.email, config);

    return self;
}

EmailSender.prototype.sendMail = function(from, to, subject, tplName, locals, attachments, subDir) {
    let self = this;
    let d = Q.defer();
    let templatePath = path.resolve(appRoot.path, self.config.emailTplsDir);

    if(subDir && fs.existsSync(path.resolve(appRoot.path, self.config.emailTplsDir, subDir, tplName)))
    {
        templatePath = path.resolve(appRoot.path, self.config.emailTplsDir, subDir);
    }

    if(!fs.existsSync(path.resolve(templatePath, tplName))) {
        d.reject(new Error("Template path does not exists: " + path.resolve(templatePath, tplName)));
    }
    else {
        // Lets add moment to the locals, just because its handy
        locals.moment = moment;

        // Lets define the open app for debugging
        let platformApp = 'google-chrome';
        if(process.platform ==='win32') platformApp = 'chrome';
        else if(process.platform === 'darwin') platformApp = 'google chrome';

        const email = new Email({transport: self.config.smtp, views: {root: templatePath}, preview: { open: { app: platformApp, wait: false } } });

        email.send({
            template: tplName,
            message: {
                from: from,
                to: to,
                subject: subject,
                attachments: attachments
            },
            locals: locals
        })
            .then(d.resolve)
            .catch(d.reject);
    }
    return d.promise;
};

EmailSender.prototype.sendSimpleMail = function(from, to, subject, bodyType, body, attachments) {
    let self = this;
    let d = Q.defer();

    const transporter = nodemailer.createTransport(self.config.smtp);
    let message = {
        from: from,
        to: to,
        subject: subject,
        attachments: attachments
    };

    if(bodyType === 'HTML') message.html = body;
    else message.text = body;

    transporter.sendMail(message)
        .then(d.resolve)
        .catch(d.reject);

    return d.promise;
};

module.exports = EmailSender;
