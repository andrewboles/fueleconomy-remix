// auth.server.ts
import { Authenticator } from 'remix-auth'
import { sessionStorage, getSession } from '~/utils/session.server'
import { MicrosoftStrategy } from 'remix-auth-microsoft'

//this utilized a handy remix auth package for tying OAuth2 credentials to Remix session storage
export let authenticator = new Authenticator(sessionStorage)

const microsoftStrategy = new MicrosoftStrategy(
    {
      clientID: process.env.MS_CLIENT_ID || '',
      clientSecret: process.env.MS_CLIENT_SECRET || '',
      callbackURL: process.env.PRIMARY_URL + '/auth/microsoft/callback', 
    },
    async ({ profile }) => {
      console.log(profile)
      return profile
    },
  )

authenticator.use(microsoftStrategy)
