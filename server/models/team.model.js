import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true, 
    minlength: 3, 
    maxlength: 3 
  },
  flagUrl: { 
    type: String, 
    default: '' 
  },
  group: { 
    type: String, 
    required: true, 
    uppercase: true, 
    default: 'A'
  }
}, { timestamps: true });

export default mongoose.model('Team', teamSchema);