const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// Local strategy for login
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
},
async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return done(null, false, { message: 'Invalid credentials' }); // Failure flash message
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return done(null, false, { message: 'Invalid credentials' });
        }

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

// Serialize and Deserialize user for session storage
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;
