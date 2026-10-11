
const SupportTicket = require("../models/SupportTicket");

const STAFF_ROLES = ["HOSPITAL_ADMIN"];

// Create a support ticket
const createSupportTicket = async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;

    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.trim().length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Subject is required and must be 150 characters or fewer.",
      });
    }

    if (
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 3000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Description is required and must be 3000 characters or fewer.",
      });
    }

    const allowedCategories = [
      "LOGIN",
      "DOCUMENT_UPLOAD",
      "APPOINTMENT",
      "AI_CHATBOT",
      "PAYMENT",
      "ACCOUNT",
      "OTHER",
    ];

    const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

    if (category && !allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket category.",
      });
    }

    // Users cannot mark their own tickets as urgent.
    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket priority.",
      });
    }

    const ticket = await SupportTicket.create({
      userId: req.user.userId,
      subject: subject.trim(),
      description: description.trim(),
      category: category || "OTHER",
      priority: "MEDIUM",
    });

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully.",
      data: ticket,
    });
  } catch (error) {
    console.error("Create support ticket error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create support ticket.",
    });
  }
};

// Get the logged-in user's tickets
const getMySupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({
      userId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets,
    });
  } catch (error) {
    console.error("Get support tickets error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve support tickets.",
    });
  }
};

// View all tickets — hospital administrators only
const getAllSupportTickets = async (req, res) => {
  try {
    if (!STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can view all tickets.",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = [
        "OPEN",
        "IN_PROGRESS",
        "WAITING_FOR_USER",
        "RESOLVED",
        "CLOSED",
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket status.",
        });
      }

      filter.status = req.query.status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate("userId", "name email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      SupportTicket.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all support tickets error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve support tickets.",
    });
  }
};

// Update ticket status — hospital administrators only
const updateSupportTicket = async (req, res) => {
  try {
    if (!STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can update tickets.",
      });
    }

    const { status, priority, resolution } = req.body;
    const updates = {};

    const allowedStatuses = [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_FOR_USER",
      "RESOLVED",
      "CLOSED",
    ];

    const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket status.",
        });
      }

      updates.status = status;
      updates.lastUpdatedBy = req.user.userId;

      if (status === "RESOLVED" || status === "CLOSED") {
        updates.resolvedAt = new Date();
      } else {
        updates.resolvedAt = null;
      }
    }

    if (priority !== undefined) {
      if (!allowedPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket priority.",
        });
      }

      updates.priority = priority;
    }

    if (resolution !== undefined) {
      if (
        typeof resolution !== "string" ||
        resolution.length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Resolution must be 2000 characters or fewer.",
        });
      }

      updates.resolution = resolution.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket updated successfully.",
      data: ticket,
    });
  } catch (error) {
    console.error("Update support ticket error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update support ticket.",
    });
  }
};

module.exports = {
  createSupportTicket,
  getMySupportTickets,
  getAllSupportTickets,
  updateSupportTicket,
};
