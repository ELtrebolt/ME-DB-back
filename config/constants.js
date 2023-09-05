// Only for local not deployment
require('dotenv').config();

let json = {}
if(process.env.STATUS === 'local')
{
    json['CLIENT_URL'] = "http://localhost:3000";
    json['SERVER_CALLBACK_URL'] = "http://localhost:8082/auth/google/callback";
}
// https://me-db.cyclic.cloud/auth/google/callback
else if(process.env.STATUS === 'deploy')
{
    json = {
        'CLIENT_URL': "https://www.me-db.tech",
        'SERVER_CALLBACK_URL': "https://api.me-db.tech/auth/google/callback"
    };
}
module.exports = json;