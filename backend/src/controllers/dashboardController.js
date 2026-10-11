
const User = require("../models/User");
const Document = require("../models/Document");

const getMyDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "name email role phone hospitalId preferredLanguage createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const patientId = user._id;

    const [
      totalDocuments,
      labReports,
      prescriptions,
      dischargeSummaries,
      latestDocuments,
    ] = await Promise.all([
      Document.countDocuments({ patientId }),
      Document.countDocuments({
        patientId,
        documentType: "LAB_REPORT",
      }),
      Document.countDocuments({
        patientId,
        documentType: "PRESCRIPTION",
      }),
      Document.countDocuments({
        patientId,
        documentType: "DISCHARGE_SUMMARY",
      }),
      Document.find({ patientId })
        .select(
          "originalName documentType processingStatus size createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || null,
        hospitalId: user.hospitalId || null,
        preferredLanguage: user.preferredLanguage || null,
        joinedAt: user.createdAt,
      },
      statistics: {
        totalDocuments,
        labReports,
        prescriptions,
        dischargeSummaries,
        otherDocuments:
          totalDocuments -
          labReports -
          prescriptions -
          dischargeSummaries,
      },
      latestDocuments,
    });
  } catch (error) {
    console.error("Dashboard retrieval failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load dashboard data.",
    });
  }
};

const updateMyLanguagePreference = async (req, res) => {
  const supportedLanguages = ["en", "te", "hi", "ta"];
  const preferredLanguage = req.body?.preferredLanguage;
  if (!supportedLanguages.includes(preferredLanguage)) {
    return res.status(400).json({
      success: false,
      message: "Choose English, Telugu, Hindi, or Tamil.",
    });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { preferredLanguage } },
      { new: true, runValidators: true }
    ).select("_id preferredLanguage");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }
    return res.status(200).json({
      success: true,
      preferredLanguage: user.preferredLanguage,
    });
  } catch (error) {
    console.error("Language preference update failed.");
    return res.status(500).json({
      success: false,
      message: "Unable to save your language preference.",
    });
  }
};

module.exports = { getMyDashboard, updateMyLanguagePreference };
