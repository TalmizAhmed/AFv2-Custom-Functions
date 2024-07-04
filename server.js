import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { Octokit } from 'octokit';
import cookieParser from 'cookie-parser';

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CALLBACK_URL = '/complete';
const CUSTOM_FUNCTIONS_URL = '/customFunctions';
const COOKIE_TOKEN = 'CFAPP_TOKEN';
const PORT = 8080;
const app = express();

app.use(cookieParser());
app.use(express.json());
const accessTokens = {};

// const octoApp = new Octokit({
//     appId: process.env.APP_ID,
//     privateKey: "./aem-forms-custom-functions.2024-07-03.private-key.pem",
// });
// let octokit;
const exchangeCode = async (code) => {
    try {
        const response = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
        }, {
            headers: {
                Accept: 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error(error);
        return {};
    }
};

const checkToken = (req, res, next) => {
    const token = req.cookies[COOKIE_TOKEN];
    if (accessTokens[token]) {
        next();
    } else {
        res.status(401).send('Unauthorized');
    }
}

const getCustomFunctions = async (repo, path, token) => {
    const user = accessTokens[token];
    const owner = user.login;
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`
            }
        });

        return response.data;
    } catch (error) {
        console.error(error);
        return {};
    }
}

const updateCustomFunctions = async (repo, path, token, content) => {
    const user = accessTokens[token];
    const owner = user.login;
    const existingContent = await getCustomFunctions(repo, path, token);
    try {
        const response = await axios.put(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`,{
            message: 'Update custom functions',
            content: content,
            sha: existingContent.sha,
            committer: {
                name: user.name,
                email: user.email
            }
        }, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`
            },
        });

        return response.status;
    } catch (error) {
        console.error(error.response.data);
        return {};
    }
    // try {
    //     const update = await octokit.rest.repos.createOrUpdateFileContents({
    //         owner,
    //         repo,
    //         path,
    //         message: "Update custom functions",
    //         content: "Updated code content f()",
    //         sha: existingContent.sha,
    //     })
    //     return update;
    // } catch (e) {
    //     console.error(e);
    //     return {}
    // }
}

const userInfo = async (token) => {
    try {
        const response = await axios.get('https://api.github.com/user', {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`
            }
        });

        return response.data;
    } catch (error) {
        console.error(error);
        return {};
    }
};

const getEmail = async (token) => {
    try {
        const response = await axios.get('https://api.github.com/user/emails', {
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`
            }
        });

        return response.data[0].email;
    } catch (e) {
        console.error(e);
        return {}
    }
}

app.get('/', (req, res) => {
    const link = `<a href="https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}">Login with GitHub</a>`;
    res.send(link);
});

app.get(CALLBACK_URL, async (req, res) => {
    const code = req.query.code;
    // const installationId = req.query.installation_id
    // octokit = await octoApp.getInstallationOctokit(installationId);
    // const tokenData = await exchangeCode(code);

    if (tokenData.access_token) {
        let user = await userInfo(tokenData.access_token);
        user.email = await getEmail(tokenData.access_token)
        accessTokens[tokenData.access_token] = user;
        res.cookie(COOKIE_TOKEN, tokenData.access_token, { httpOnly: false });
        const render = `Successfully authorized! Welcome, ${user.name} (${user.login}).`;
        res.send(render);
    } else {
        const render = `Authorized, but unable to exchange code ${code} for token.`;
        res.send(render);
    }
    // res.send(`${code}`);
});

app.get(CUSTOM_FUNCTIONS_URL, checkToken ,async(req, res) => {
    const {repo, path} = req.query;
    const token = req.cookies[COOKIE_TOKEN];
    const {content} = await getCustomFunctions(repo, path, token);
    const decodedContent = Buffer.from(content, 'base64').toString();
    const render = `Data: ${JSON.stringify(decodedContent)}`
    res.send(render)
})

app.post(CUSTOM_FUNCTIONS_URL + "/sendUpdate", async (req, res) => {
    const {repo, path} = req.query;
    const token = req.cookies[COOKIE_TOKEN];
    const status = await updateCustomFunctions(repo, path, token, req.body.content);
    if(status.toString().startsWith('2')) {
        res.send('Content updated successfully');
    }
    res.send('Error updating content');
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));