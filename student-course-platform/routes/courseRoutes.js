const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware to check authentication
function isAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) return res.redirect('/login');
    next();
}

// Middleware to check if user is a teacher
function isTeacher(req, res, next) {
    if (req.user.role !== 'teacher') return res.status(403).send('Only teachers can access this resource');
    next();
}

// Ensure the uploads directories exist
const uploadDirs = ['uploads/course_thumbnails', 'uploads/course_materials', 'uploads/course_videos'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure multer for course creation (handle both thumbnail and materials)
const uploadCourse = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            if (file.fieldname === 'thumbnail') {
                cb(null, 'uploads/course_thumbnails/');
            } else if (file.fieldname === 'materials') {
                cb(null, 'uploads/course_materials/');
            } else {
                cb(new Error('Unexpected field'));
            }
        },
        filename: function(req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Add a general upload configuration for single file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, 'uploads/course_thumbnails/');
        },
        filename: function(req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Define uploadThumbnail and uploadMaterial for the other routes that reference them
const uploadThumbnail = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, 'uploads/course_thumbnails/');
        },
        filename: function(req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit for thumbnails
    }
});

const uploadMaterial = multer({
    storage: multer.diskStorage({
        destination: function(req, file, cb) {
            cb(null, 'uploads/course_materials/');
        },
        filename: function(req, file, cb) {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    }),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for materials
    }
});

// Home page with top 3 courses
router.get('/home', async (req, res) => {
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
    }catch (error) {
        console.error("Error fetching courses:", error);
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

// View all courses - accessible to all users
router.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find().populate('teacher', 'name');
        res.render('courses', { 
            courses, 
            user: req.user || null 
        });
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).send('Error fetching courses');
    }
});

// Create a new course page
router.get('/courses/new', isAuthenticated, isTeacher, (req, res) => {
    res.render('new-course', { user: req.user });
});

// Create a new course - POST handler
router.post('/courses', isAuthenticated, isTeacher, (req, res) => {
    const upload = uploadCourse.fields([
        { name: 'thumbnail', maxCount: 1 },
        { name: 'materials', maxCount: 5 }
    ]);

    upload(req, res, async function(err) {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).send(err.message);
        }

        try {
            const { title, description } = req.body;
            let thumbnailPath = '';
            if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
                thumbnailPath = `/uploads/course_thumbnails/${req.files.thumbnail[0].filename}`;
            }
            let materialPaths = [];
            if (req.files && req.files.materials) {
                materialPaths = req.files.materials.map(file => 
                    `/uploads/course_materials/${file.filename}`
                );
            }
            const newCourse = new Course({
                title,
                description,
                name: title, // Add this line to set name equal to title
                teacher: req.user._id,
                thumbnail: thumbnailPath,
                materials: materialPaths,
                students: [] // Initialize with empty students array
            });
            await newCourse.save();
            res.redirect('/my-courses');
        } catch (error) {
            console.error('Course creation error:', error);
            res.status(500).send('Error creating course');
        }
    });
});
// View a single course - consistent path
router.get('/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).populate('teacher', 'name');
        
        if (!course) {
            return res.status(404).send('Course not found');
        }
        
        // Check if user is authenticated
        const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
        let isTeacher = false;
        let isEnrolled = false;
        
        if (isAuthenticated && req.user) {
            isTeacher = course.teacher && course.teacher._id.toString() === req.user._id.toString();
            isEnrolled = course.students && 
                      Array.isArray(course.students) && 
                      course.students.some(student => student.toString() === req.user._id.toString());
        }
        
        // If authenticated student is not enrolled and not the teacher, redirect
        if (isAuthenticated && req.user.role === 'student' && !isTeacher && !isEnrolled) {
            return res.redirect('/courses');
        }
        
        res.render('course-details', { 
            course, 
            user: req.user || null,
            isTeacher,
            isEnrolled
        });
    } catch (error) {
        console.error('Error fetching course:', error);
        res.status(500).send('Error fetching course details');
    }
});

// My Courses Route - For both students and teachers
router.get('/my-courses', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        let enrolledCourses = [];
        let teachingCourses = [];
        
        if (user.role === 'student') {
            // Find courses where the student is enrolled
            enrolledCourses = await Course.find({
                students: user._id
            }).populate('teacher', 'name').lean().exec();
        } 
        
        if (user.role === 'teacher') {
            // Find courses where the user is the teacher
            teachingCourses = await Course.find({
                teacher: user._id
            }).lean().exec();
        }
        
        res.render('my-courses', {
            user,
            enrolledCourses,
            teachingCourses
        });
    } catch (err) {
        console.error("Error fetching my courses:", err);
        res.status(500).send("Server Error: " + err.message);
    }
});

// Update Course
router.post('/courses/edit/:id', upload.single('thumbnail'), async (req, res) => {
    try {
      const courseId = req.params.id;
      const { title, description } = req.body;
      
      // Find the course
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).send('Course not found');
      }
      
      // Check if user is authorized to edit this course
      if (req.user.role === 'teacher' && course.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).send('Not authorized to edit this course');
      }
      
      // Update the course
      course.title = title;
      course.description = description;
      course.name = title; // Add this line to set the name field equal to title
      
      // Handle thumbnail upload if a new file was provided
      if (req.file) {
        const thumbnailUrl = '/uploads/' + req.file.filename;
        course.thumbnail = thumbnailUrl;
      }
      
      await course.save();
      
      res.redirect(`/courses/${courseId}`);
    } catch (error) {
      console.error('Error updating course:', error);
      res.status(500).send('Server error');
    }
  });

// Enroll in a course
router.post('/courses/enroll/:id', isAuthenticated, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user._id;
        
        // Check if user is a student
        if (req.user.role !== 'student') {
            return res.status(403).send('Only students can enroll in courses');
        }
        
        // Find the course
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).send('Course not found');
        }
        
        // Check if user is already enrolled
        if (course.students && course.students.some(studentId => studentId.toString() === userId.toString())) {
            return res.send('You are already enrolled in this course');
        }
        
        // Check if the user is trying to enroll in their own course
        if (course.teacher.toString() === userId.toString()) {
            return res.send('You cannot enroll in your own course');
        }
        
        // Add user to course students
        if (!course.students) {
            course.students = [];
        }
        course.students.push(userId);
        await course.save();
        
        // Redirect to course page
        res.redirect(`/courses/${courseId}`);
    } catch (error) {
        console.error('Enrollment error:', error);
        res.status(500).send('Error enrolling in course');
    }
});


// GET route to display the edit course form
router.get('/courses/edit/:id', async (req, res) => {
    try {
      const courseId = req.params.id;
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).send('Course not found');
      }
      
      // Make sure the course belongs to the current user (if teacher)
      if (req.user.role === 'teacher' && course.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).send('Not authorized to edit this course');
      }
      
      res.render('editCourse', { course });
    } catch (error) {
      console.error('Error fetching course for edit:', error);
      res.status(500).send('Server error');
    }
  });
  
  // POST route to handle the form submission
  router.post('/courses/edit/:id', upload.single('thumbnail'), async (req, res) => {
    try {
      const courseId = req.params.id;
      const { title, description } = req.body;
      
      // Find the course
      const course = await Course.findById(courseId);
      
      if (!course) {
        return res.status(404).send('Course not found');
      }
      
      // Check if user is authorized to edit this course
      if (req.user.role === 'teacher' && course.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).send('Not authorized to edit this course');
      }
      
      // Update the course
      course.title = title;
      course.description = description;
      
      // Handle thumbnail upload if a new file was provided
      if (req.file) {
        // Assuming you have a function to process uploads and get a URL
        const thumbnailUrl = '/uploads/' + req.file.filename;
        course.thumbnail = thumbnailUrl;
      }
      
      await course.save();
      
      res.redirect(`/courses/${courseId}`);
    } catch (error) {
      console.error('Error updating course:', error);
      res.status(500).send('Server error');
    }
  });

// Upload course materials
router.post('/courses/:id/upload', isAuthenticated, isTeacher, (req, res) => {
    uploadMaterial.single('file')(req, res, async function(err) {
        if (err) {
            console.error('Material upload error:', err);
            return res.status(400).send(err.message);
        }
        
        try {
            const course = await Course.findById(req.params.id);
            
            if (!course) {
                return res.status(404).send('Course not found');
            }
            
            // Check if user is the course teacher
            if (course.teacher.toString() !== req.user._id.toString()) {
                return res.status(403).send('You can only upload materials to your own courses');
            }
            
            if (req.file) {
                const materialPath = `/uploads/course_materials/${req.file.filename}`;
                course.materials.push(materialPath);
                await course.save();
            }
            
            res.redirect(`/courses/${course._id}`);
        } catch (error) {
            console.error('Error uploading material:', error);
            res.status(500).send('Error uploading course material');
        }
    });
});

// Delete a course
router.post('/courses/delete/:id', isAuthenticated, isTeacher, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        
        if (!course) {
            return res.status(404).send('Course not found');
        }
        
        // Check if user is the course teacher
        if (course.teacher.toString() !== req.user._id.toString()) {
            return res.status(403).send('You can only delete your own courses');
        }
        
        // Delete the course
        await Course.findByIdAndDelete(req.params.id);
        res.redirect('/my-courses');
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).send('Error deleting course');
    }
});

// Unenroll from a course
router.post('/courses/unenroll/:id', isAuthenticated, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        
        if (!course) {
            return res.status(404).send('Course not found');
        }
        
        // Remove student from course
        if (course.students) {
            course.students = course.students.filter(
                studentId => studentId.toString() !== req.user._id.toString()
            );
            await course.save();
        }
        
        res.redirect('/my-courses');
    } catch (error) {
        console.error('Error unenrolling from course:', error);
        res.status(500).send('Error unenrolling from course');
    }
});

// API route to get top courses
router.get('/api/top-courses', async (req, res) => {
    try {
        const topCourses = await Course.find().sort({ students: -1 }).limit(3);
        res.json(topCourses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch top courses' });
    }
});

module.exports = router;
