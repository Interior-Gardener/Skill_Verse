// In homeRoutes.js
const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const User = require('../models/User');

router.get('/', async (req, res) => {
    try {
        const topCourses = await Course.find().sort({ students: -1 }).limit(3);
        // Get actual counts for stats
        let studentCount = 0;
        const totalStudents = await Course.aggregate([
            { $unwind: { path: "$students", preserveNullAndEmptyArrays: false } },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]);
        if (totalStudents.length > 0) {
            studentCount = totalStudents[0].count;
        }
        // Count instructors (teachers)
        const instructorCount = await User.countDocuments({ role: 'teacher' });
        // Count total courses
        const courseCount = await Course.countDocuments();
        res.render('home', { 
            courses: topCourses,
            user: req.user || null,
            stats: {
                students: studentCount,
                instructors: instructorCount,
                courses: courseCount
            }
        });
    } catch (error) {
        console.error("Error fetching homepage data:", error);
        // Provide fallback stats in case of error
        res.render('home', { 
            courses: [],
            user: req.user || null,
            stats: {
                students: 0,
                instructors: 0,
                courses: 0
            }
        });
    }
});

module.exports = router;
