import cloudinary from "../config/cloudinary.js";

export const uploadWorkoutMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `workouts/${req.user.id}`,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    return res.json({
      url: result.secure_url, // 👈 frontend expects this
    });
  } catch (error) {
    console.error("uploadWorkoutMedia error:", error);
    return res.status(500).json({
      message: "Upload failed",
    });
  }
};
