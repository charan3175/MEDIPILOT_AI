
const ABHAProfile = require("../models/ABHAProfile");

const ALLOWED_CONSENT_FIELDS = [
  "shareHealthRecords",
  "shareLabReports",
  "sharePrescriptions",
];

// Get the logged-in patient's ABHA profile
const getMyABHAProfile = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "Only patients can access this profile.",
      });
    }

    const profile = await ABHAProfile.findOne({
      patientId: req.user.userId,
    }).lean();

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Get ABHA profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve ABHA profile.",
    });
  }
};

// Create or update the patient's ABHA profile
const saveMyABHAProfile = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "Only patients can manage this profile.",
      });
    }

    const { abhaAddress, abhaNumberLastFour } = req.body;

    if (
      abhaAddress !== undefined &&
      (typeof abhaAddress !== "string" || abhaAddress.length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ABHA address.",
      });
    }

    if (
      abhaNumberLastFour !== undefined &&
      !/^\d{4}$/.test(String(abhaNumberLastFour))
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter only the last four digits of the ABHA number.",
      });
    }

    const updates = {};

    if (abhaAddress !== undefined) {
      updates.abhaAddress = abhaAddress.trim().toLowerCase() || undefined;
    }

    if (abhaNumberLastFour !== undefined) {
      updates.abhaNumberLastFour = String(abhaNumberLastFour);
    }

    const profile = await ABHAProfile.findOneAndUpdate(
      { patientId: req.user.userId },
      {
        $set: updates,
        $setOnInsert: {
          patientId: req.user.userId,
          verificationStatus: "NOT_VERIFIED",
          integrationStatus: "NOT_CONNECTED",
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
      message: "ABHA profile saved. Verification is not yet confirmed.",
      data: profile,
    });
  } catch (error) {
    console.error("Save ABHA profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save ABHA profile.",
    });
  }
};

// Update or revoke the patient's record-sharing consent
const updateABHAConsent = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "Only patients can manage their consent.",
      });
    }

    const { consent } = req.body;

    if (!consent || typeof consent !== "object" || Array.isArray(consent)) {
      return res.status(400).json({
        success: false,
        message: "Provide valid consent settings.",
      });
    }

    const consentUpdates = {};

    for (const field of ALLOWED_CONSENT_FIELDS) {
      if (consent[field] !== undefined) {
        if (typeof consent[field] !== "boolean") {
          return res.status(400).json({
            success: false,
            message: `${field} must be true or false.`,
          });
        }

        consentUpdates[`consent.${field}`] = consent[field];
      }
    }

    if (Object.keys(consentUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid consent settings were provided.",
      });
    }

    const grantsConsent = ALLOWED_CONSENT_FIELDS.some(
      (field) => consent[field] === true
    );

    const profile = await ABHAProfile.findOne({
      patientId: req.user.userId,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Create your ABHA profile before setting consent.",
      });
    }

    Object.entries(consentUpdates).forEach(([path, value]) => {
      const field = path.split(".")[1];
      profile.consent[field] = value;
    });

    const anyConsentEnabled = ALLOWED_CONSENT_FIELDS.some(
      (field) => profile.consent[field] === true
    );

    if (anyConsentEnabled) {
      profile.consent.consentGrantedAt = new Date();
      profile.consent.consentRevokedAt = null;
    } else {
      profile.consent.consentRevokedAt = new Date();
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: grantsConsent
        ? "Consent settings updated."
        : "Consent settings updated. No new consent was granted.",
      data: profile.consent,
    });
  } catch (error) {
    console.error("Update ABHA consent error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update consent settings.",
    });
  }
};

module.exports = {
  getMyABHAProfile,
  saveMyABHAProfile,
  updateABHAConsent,
};
