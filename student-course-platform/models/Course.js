const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Primary course name
    title: { type: String }, // Course title (optional now)
    description: { type: String }, // Course description (no longer required)
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to teacher
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Enrolled students
    thumbnail: { type: String }, // Thumbnail path (optional)
    videos: [{ type: String }], // Array of video URLs
    materials: [{ type: String }], // Array of materials (PDFs, Docs, etc.)
    notes: [{ type: String }], // Array of notes
}, { timestamps: true });

// Virtual field: Count of enrolled students
CourseSchema.virtual('studentsCount').get(function () {
    return this.students.length;
});

// Ensure virtuals are included when converting to JSON
CourseSchema.set('toJSON', { virtuals: true });
CourseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Course', CourseSchema);
