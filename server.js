require('dotenv').config()
const fs = require('fs')
const express = require('express');
const { google } = require('googleapis')
const Base64 = require("js-base64");
const https = require('https');
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//set SCOPES
const SCOPES = [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/userinfo.email'
]


//set filename variables
const TOKEN_PATH = 'token.json';
const USER_DATA = 'user.json';


let oAuth2Client;
//fatch credentials........
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Client Secret File Error', err);

    const contentData = JSON.parse(content)
    const { client_id, client_secret, redirect_uris } = contentData.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris);//authorize...................
});



//first setcredentials second sendemail
app.get('/setcredentials', (req, res) => {
    let authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    res.redirect(authUrl);
});

//redirect link
app.get('/google/auth', (req, res) => {
    const { code } = req.query;
    //get tokens
    oAuth2Client.getToken(code, (err, tokens) => {
        if (err) return console.error('Error retrieving access token', err);
        //Store token 
        fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', TOKEN_PATH);
        });

        //userdata
        let userUrl = "https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + tokens.access_token
        https.get(userUrl, (res) => {
            let data = "";
            res.on('data', (result) => {
                data = JSON.parse(result);
                //STORE USER
                fs.writeFile(USER_DATA, JSON.stringify(data), (err) => {
                    if (err) return console.error(err);
                    console.log('Token stored to', USER_DATA);
                });
            });
        });

        if (!err) {
            //setCredentials...
            oAuth2Client.setCredentials(tokens);
            return res.send('SEND EMAIL - http://localhost:3000/sendemail' );
        }
        else {
            return res.json({ Error: "EMAIL AUTH ERROR" })
        }
    });
});



//send function
const sendEmail = (auth, mail) => {
    const gmail = google.gmail({ version: 'v1', auth });

    let encodeMessage = Base64.encodeURI(mail);
    let email = gmail.users.messages.send({
        userId: 'me',
        resource: {
            raw: encodeMessage
        }
    })
    return email;
}

//message body
const mailBody = (from, to, subject, body) => {
    let mailData = [
        `From:${from}`,
        `To:${to}`,
        `Subject:${subject}`,
        `\n${body}`
    ];
    let mail = mailData.join('\n');
    return mail;
}

//SENDING EMAIL.........
app.post('/sendemail', (req, res) => {

    if (oAuth2Client.credentials.access_token !== undefined) {

        try {
            // read user information....
            fs.readFile(USER_DATA, (err, content) => {
                if (err) return err;

                const contentData = JSON.parse(content)
                let mail = mailBody(contentData.email, req.body.to, req.body.subject, req.body.mailBody);
                let email = sendEmail(oAuth2Client, mail).then(result => {
                    console.log('send Email....', result)
                }).catch((error) => console.log("EMAILERR", error))
                res.send("EMAIL SEND SUCCESS")
            });

        } catch (error) {
            res.json({ Error: "EMAIL ERROR",error})
        }

    } else {

        res.json({ Error: "SET ACCESS AND REFRESH TOKEN http:localhost:3000/setcredentials " })
    }
});

app.listen(process.env.PORT, () => console.log(`listening on port ${process.env.PORT}`))