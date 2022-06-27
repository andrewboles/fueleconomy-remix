// auth.server.ts
import { Authenticator } from 'remix-auth'
import { sessionStorage, getSession } from '~/utils/session.server'
import { MicrosoftStrategy } from 'remix-auth-microsoft'

export let authenticator = new Authenticator(sessionStorage)

const microsoftStrategy = new MicrosoftStrategy(
    {
      clientID: process.env.MS_CLIENT_ID || '',
      clientSecret: process.env.MS_CLIENT_SECRET || '',
      callbackURL: process.env.PRIMARY_URL + '/auth/microsoft/callback', 
      tenant: process.env.MS_TENANT || '',
      scope: "openid profile email", // optional
      prompt: "login", 
    },
    async ({ profile }) => {
      console.log(profile)
      return profile
    },
  )

authenticator.use(microsoftStrategy)
