
const DoctorProfile = require("../models/DoctorProfile");
const User = require("../models/User");

// Get doctor profiles awaiting verification
const getPendingDoctors = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can review doctor profiles.",
      });
    }

    const profiles = await DoctorProfile.find({ isVerified: false })
      .sort({ createdAt: 1 })
      .populate({
        path: "userId",
        select: "name email phone role isActive hospitalId",
        match: { role: "DOCTOR", isActive: true },
      })
      .lean();

    const pendingDoctors = profiles.filter((profile) => profile.userId);

    return res.status(200).json({
      success: true,
      count: pendingDoctors.length,
      doctors: pendingDoctors,
    });
  } catch (error) {
    console.error("Get pending doctors error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve pending doctor profiles.",
    });
  }
};

// Verify a doctor profile
const verifyDoctor = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can verify doctors.",
      });
    }

    const profile = await DoctorProfile.findById(req.params.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found.",
      });
    }

    const doctor = await User.findOne({
      _id: profile.userId,
      role: "DOCTOR",
      isActive: true,
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Active doctor account not found.",
      });
    }

    profile.isVerified = true;
    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Doctor profile verified successfully.",
      doctor: {
        profileId: profile._id,
        userId: doctor._id,
        name: doctor.name,
        specialization: profile.specialization,
        isVerified: profile.isVerified,
      },
    });
  } catch (error) {
    console.error("Verify doctor error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify doctor profile.",
    });
  }
};

// Revoke verification when necessary
const revokeDoctorVerification = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can change verification.",
      });
    }

    const profile = await DoctorProfile.findByIdAndUpdate(
      req.params.id,
      { $set: { isVerified: false } },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Doctor verification revoked.",
      profile,
    });
  } catch (error) {
    console.error("Revoke doctor verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to revoke doctor verification.",
    });
  }
};

module.exports = {
  getPendingDoctors,
  verifyDoctor,
  revokeDoctorVerification,
};
