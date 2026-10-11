const DoctorProfile = require("../models/DoctorProfile");
const User = require("../models/User");

const getAvailableDoctors = async (req, res) => {
  try {
    const {
      specialization,
      hospitalId,
      language,
      search,
    } = req.query;

    const filter = {
      acceptsAppointments: true,
      isVerified: true,
    };

    if (specialization) {
      filter.specialization = {
        $regex: specialization,
        $options: "i",
      };
    }

    if (hospitalId) {
      filter.hospitalId = hospitalId;
    }

    if (language) {
      filter.languages = {
        $regex: language,
        $options: "i",
      };
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { specialization: { $regex: safeSearch, $options: "i" } },
        { hospitalName: { $regex: safeSearch, $options: "i" } },
        { qualification: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const profiles = await DoctorProfile.find(filter)
      .sort({ experienceYears: -1 })
      .limit(100)
      .lean();

    const activeDoctors = await User.find({
      _id: { $in: profiles.map((profile) => profile.userId) },
      role: "DOCTOR",
      isActive: true,
    })
      .select("_id name")
      .lean();

    const doctorNames = new Map(
      activeDoctors.map((doctor) => [
        doctor._id.toString(),
        doctor.name,
      ])
    );

    const doctors = profiles
      .filter((profile) => doctorNames.has(profile.userId.toString()))
      .map((profile) => ({
        id: profile.userId,
        name: doctorNames.get(profile.userId.toString()),
        specialization: profile.specialization,
        qualification: profile.qualification,
        experienceYears: profile.experienceYears,
        hospitalName: profile.hospitalName,
        hospitalId: profile.hospitalId,
        consultationFee: profile.consultationFee,
        languages: profile.languages,
        bio: profile.bio,
        availability: profile.availability,
      }));

    return res.status(200).json({
      success: true,
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error("Fetch doctors failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load available doctors.",
    });
  }
};

const getDoctorProfile = async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({
      userId: req.params.doctorId,
      isVerified: true,
      acceptsAppointments: true,
    }).lean();

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found or unavailable.",
      });
    }

    const doctor = await User.findOne({
      _id: profile.userId,
      role: "DOCTOR",
      isActive: true,
    })
      .select("_id name")
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor account is unavailable.",
      });
    }

    return res.status(200).json({
      success: true,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        specialization: profile.specialization,
        qualification: profile.qualification,
        experienceYears: profile.experienceYears,
        hospitalName: profile.hospitalName,
        consultationFee: profile.consultationFee,
        languages: profile.languages,
        bio: profile.bio,
        availability: profile.availability,
      },
    });
  } catch (error) {
    console.error("Fetch doctor profile failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load doctor profile.",
    });
  }
};

const getMyDoctorProfile = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctor accounts can access this endpoint.",
      });
    }

    const profile = await DoctorProfile.findOne({
      userId: req.user.userId,
    }).lean();

    return res.status(200).json({
      success: true,
      profile: profile || null,
    });
  } catch (error) {
    console.error("Fetch own doctor profile failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load doctor profile.",
    });
  }
};

const upsertMyDoctorProfile = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctor accounts can create a doctor profile.",
      });
    }

    const allowedFields = [
      "specialization",
      "qualification",
      "experienceYears",
      "registrationNumber",
      "hospitalName",
      "hospitalId",
      "consultationFee",
      "languages",
      "bio",
      "availability",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (
      typeof updates.specialization !== "string" ||
      !updates.specialization.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Specialization is required.",
      });
    }

    if (
      updates.experienceYears !== undefined &&
      (!Number.isFinite(updates.experienceYears) ||
        updates.experienceYears < 0 ||
        updates.experienceYears > 80)
    ) {
      return res.status(400).json({
        success: false,
        message: "Experience must be between 0 and 80 years.",
      });
    }

    if (
      updates.consultationFee !== undefined &&
      (!Number.isFinite(updates.consultationFee) ||
        updates.consultationFee < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Consultation fee must be zero or greater.",
      });
    }

    if (
      updates.languages !== undefined &&
      (!Array.isArray(updates.languages) ||
        !updates.languages.every(
          (language) =>
            typeof language === "string" && language.trim().length > 0
        ))
    ) {
      return res.status(400).json({
        success: false,
        message: "Languages must be a list of non-empty strings.",
      });
    }

    if (
      updates.availability !== undefined &&
      !Array.isArray(updates.availability)
    ) {
      return res.status(400).json({
        success: false,
        message: "Availability must be a list.",
      });
    }

    updates.specialization = updates.specialization.trim();

    const profile = await DoctorProfile.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $set: updates,
        $setOnInsert: {
          userId: req.user.userId,
          isVerified: false,
          acceptsAppointments: true,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Doctor profile saved. It must be verified before appearing in public search.",
      profile,
    });
  } catch (error) {
    console.error("Save doctor profile failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save doctor profile.",
    });
  }
};

module.exports = {
  getAvailableDoctors,
  getDoctorProfile,
  getMyDoctorProfile,
  upsertMyDoctorProfile,
};