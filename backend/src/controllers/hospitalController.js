
const mongoose = require("mongoose");
const Hospital = require("../models/Hospital");

const registerHospital = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can register hospitals.",
      });
    }

    const {
      name,
      hospitalCode,
      address,
      city,
      state,
      pincode,
      phone,
      email,
      departments,
      services,
    } = req.body;

    if (
      !name?.trim() ||
      !hospitalCode?.trim() ||
      !address?.trim() ||
      !city?.trim() ||
      !state?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, hospital code, address, city, and state are required.",
      });
    }

    const normalizedCode = hospitalCode.trim().toUpperCase();

    const existingHospital = await Hospital.findOne({
      hospitalCode: normalizedCode,
    });

    if (existingHospital) {
      return res.status(409).json({
        success: false,
        message: "A hospital with this code already exists.",
      });
    }

    const hospital = await Hospital.create({
      name: name.trim(),
      hospitalCode: normalizedCode,
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode || "",
      phone: phone || "",
      email: email || "",
      departments: Array.isArray(departments) ? departments : [],
      services: Array.isArray(services) ? services : [],
      createdBy: req.user.userId,
      isVerified: false,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "Hospital registered and submitted for verification.",
      hospital,
    });
  } catch (error) {
    console.error("Register hospital error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "That hospital code is already in use.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to register hospital.",
    });
  }
};

const searchHospitals = async (req, res) => {
  try {
    const { city, state, department, search } = req.query;

    const filter = {
      isActive: true,
      isVerified: true,
    };

    if (city?.trim()) {
      filter.city = { $regex: escapeRegex(city.trim()), $options: "i" };
    }

    if (state?.trim()) {
      filter.state = { $regex: escapeRegex(state.trim()), $options: "i" };
    }

    if (department?.trim()) {
      filter.departments = {
        $regex: escapeRegex(department.trim()),
        $options: "i",
      };
    }

    if (search?.trim()) {
      const searchRegex = {
        $regex: escapeRegex(search.trim()),
        $options: "i",
      };

      filter.$or = [
        { name: searchRegex },
        { city: searchRegex },
        { departments: searchRegex },
        { services: searchRegex },
      ];
    }

    const hospitals = await Hospital.find(filter)
      .select(
        "name hospitalCode address city state pincode phone email departments services"
      )
      .sort({ name: 1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      count: hospitals.length,
      hospitals,
    });
  } catch (error) {
    console.error("Search hospitals error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search hospitals.",
    });
  }
};

const getHospitalById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospital ID.",
      });
    }

    const hospital = await Hospital.findOne({
      _id: req.params.id,
      isActive: true,
      isVerified: true,
    })
      .select(
        "name hospitalCode address city state pincode phone email departments services"
      )
      .lean();

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Verified hospital not found.",
      });
    }

    return res.status(200).json({
      success: true,
      hospital,
    });
  } catch (error) {
    console.error("Get hospital error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve hospital details.",
    });
  }
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  registerHospital,
  searchHospitals,
  getHospitalById,
};
