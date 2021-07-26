# Sceleton APP

App has 2 entities: User, Pet

User - auth user that can signup/signin with e-mail which is user id

Pet - pet that belonges to user. It has user reference and name as id
With pets API user can add and get his own pets

HTTP was used to save some time on making self signed cert.
Of course in real life HTTPS must be used and private key as token encoding secret
in authorization part

Password resetting e-mail a bit simplified for demo perpose and in real life it should
be with link which frontend will use to ask user to enter new password and then to make
rigth request on API.

To connect to AWS you need to put creds.json file with keys as in example file in aws folder

## Installation

Use npm to install dependencies

```bash
 npm install
```

## Usage

```bash
npm start
```
Typescript will be built to dist folder

## Testing
Tests implemented via postman collecitons and saved in folder postman.
There are no tests for password resetting because it is tricky to make postman use receive email with reset data

## License
[MIT](https://choosealicense.com/licenses/mit/)