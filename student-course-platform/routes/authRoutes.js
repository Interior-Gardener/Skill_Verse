const express = require('express');
const passport = require('passport');
const User = require('../models/User');
const Course = require('../models/Course'); // Import Course model
const multer = require('multer');
const router = express.Router();

// Register Route (GET)
router.get('/register', (req, res) => res.render('register'));

// Register Route (POST)
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.send('User already exists');
        
        user = new User({ name, email, password, role });
        await user.save();
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.redirect('/register');
    }
});

// Configure Multer for storing profile pictures
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/profile_pictures/'); // Save files to 'uploads/profile_pictures/'
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Set a unique filename based on timestamp
    }
});

const upload = multer({ storage });

// Login route
router.get('/login', (req, res) => {
    const error_msg = req.flash('error')[0]; // Get the first error message if available
    res.render('login', { error_msg }); // Pass error_msg to the view
});

router.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
}));


// Fixed Dashboard Route
router.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');

    try {
        const user = req.user;
        console.log("User:", user);

        let enrolledCourses = [];
        let teachingCourses = [];

        // Get all courses for debugging
        const allCourses = await Course.find().lean();
        console.log("All courses in database:", allCourses.length);

        if (user.role === 'student') {
            // Fixed query for students: find courses where the student's ID is in the students array
            enrolledCourses = await Course.find({
                students: user._id
            }).lean().exec();
            console.log("Found enrolled courses:", enrolledCourses.length);
        } else if (user.role === 'teacher') {
            // For teachers, find courses where teacher ID matches
            teachingCourses = await Course.find({
                teacher: user._id
            }).lean().exec();
            console.log("Found teaching courses:", teachingCourses.length);
        }

        res.render('dashboard', {
            user,
            enrolledCourses,
            teachingCourses
        });
    } catch (err) {
        console.error("Error fetching courses:", err);
        res.status(500).send("Server Error: " + err.message);
    }
});

// Profile Route
router.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');

    try {
        const user = req.user;
        let enrolledCourses = [];
        let teachingCourses = [];

        if (user.role === 'student') {
            // Find courses where the student's ID is in the students array
            enrolledCourses = await Course.find({
                students: user._id
            }).lean().exec();
        } else if (user.role === 'teacher') {
            // For teachers, find courses where teacher ID matches
            teachingCourses = await Course.find({
                teacher: user._id
            }).lean().exec();
        }

        res.render('profile', {
            user,
            enrolledCourses,
            teachingCourses
        });
    } catch (err) {
        console.error("Error fetching courses for profile:", err);
        res.status(500).send("Server Error: " + err.message);
    }
});

// Logout Route
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/login');
    });
});

module.exports = router;
