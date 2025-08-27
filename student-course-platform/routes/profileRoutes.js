const express = require('express');
const router = express.Router();

// Assuming you already have an isAuthenticated middleware to check for authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login'); // Redirect to login if not authenticated
};

// Route to get the profile page
router.get('/profile', isAuthenticated, (req, res) => {
    // Render the profile page, passing the user data to the template
    res.render('profile', { user: req.user });
});

module.exports = router;
