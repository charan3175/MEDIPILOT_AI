const Conversation = require("../models/Conversation");
const MedicalKnowledge = require("../models/MedicalKnowledge");
const {
  answerWithPatientRag,
  getOllamaStatus,
  summarizePatientOverview,
} = require("../services/ollamaRagService");

const getMyConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      userId: req.user.userId,
    })
      .select("title messages.sender messages.content messages.createdAt messages.answerType messages.grounded messages.retrievalCount messages.retrievalLimited messages.sources createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Fetch conversations failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load conversations.",
    });
  }
};

const createConversation = async (req, res) => {
  try {
    const title =
      typeof req.body.title === "string" && req.body.title.trim()
        ? req.body.title.trim().slice(0, 150)
        : "Health Assistant Chat";

    const conversation = await Conversation.create({
      userId: req.user.userId,
      title,
      messages: [],
    });

    return res.status(201).json({
      success: true,
      message: "Conversation created successfully.",
      conversation,
    });
  } catch (error) {
    console.error("Create conversation failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create conversation.",
    });
  }
};

const getLocalAIStatus = async (req, res) => {
  return res.status(200).json({
    success: true,
    ...await getOllamaStatus(),
  });
};

const getPatientHealthOverview = async (req, res) => {
  if (req.user.role !== "PATIENT") {
    return res.status(403).json({
      success: false,
      message: "This overview is only available to patient accounts.",
    });
  }

  try {
    const result = await summarizePatientOverview(req.user.userId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Patient health overview failed:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to generate a health overview.",
    });
  }
};

const ingestMedicalKnowledge = async (req, res) => {
  if (req.user.role !== "HOSPITAL_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Only a hospital administrator can approve medical reference content.",
    });
  }

  const { source, title, url, category, content, publishedDate, updatedDate } =
    req.body || {};
  if (
    typeof source !== "string" ||
    typeof title !== "string" ||
    typeof url !== "string" ||
    typeof category !== "string" ||
    typeof content !== "string" ||
    !source.trim() ||
    !title.trim() ||
    !category.trim() ||
    content.trim().length < 100 ||
    content.length > 100000
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide source, title, category, a URL, and reviewed content between 100 and 100000 characters.",
    });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({
      success: false,
      message: "Provide a valid HTTPS URL from an approved medical source.",
    });
  }
  const approvedHosts = [
    "cdc.gov",
    "fda.gov",
    "medlineplus.gov",
    "nhs.uk",
    "niddk.nih.gov",
    "nih.gov",
    "who.int",
  ];
  const host = parsedUrl.hostname.toLowerCase();
  if (
    parsedUrl.protocol !== "https:" ||
    !approvedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`))
  ) {
    return res.status(400).json({
      success: false,
      message: "Only HTTPS URLs from CDC, FDA, MedlinePlus, NHS, NIDDK, NIH, or WHO are accepted.",
    });
  }

  if (
    (publishedDate && Number.isNaN(new Date(publishedDate).getTime())) ||
    (updatedDate && Number.isNaN(new Date(updatedDate).getTime()))
  ) {
    return res.status(400).json({
      success: false,
      message: "Published and updated dates must be valid dates.",
    });
  }

  try {
    const record = await MedicalKnowledge.create({
      source: source.trim(),
      title: title.trim(),
      url: parsedUrl.toString(),
      category: category.trim(),
      content: content.trim(),
      publishedDate: publishedDate || null,
      updatedDate: updatedDate || null,
      approvedBy: req.user.userId,
    });
    return res.status(201).json({
      success: true,
      message: "Reviewed medical reference content was added.",
      reference: {
        id: record._id,
        source: record.source,
        title: record.title,
        url: record.url,
        category: record.category,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This reference already exists.",
      });
    }
    console.error("Medical knowledge ingestion failed:", error.message);
    return res.status(400).json({
      success: false,
      message: "Unable to add reviewed medical reference content.",
    });
  }
};

const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    }).lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    console.error("Fetch conversation failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load conversation.",
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    const content =
      typeof req.body.content === "string" ? req.body.content.trim() : "";

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required.",
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message must be 5000 characters or fewer.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    const { answer, sources, answerType, grounded, retrievalLimited } = await answerWithPatientRag({
      patientId: req.user.userId,
      question: content,
      history: conversation.messages,
    });

    if (!answer) {
      return res.status(502).json({
        success: false,
        message: "The AI assistant did not return a response. Please retry.",
      });
    }

    conversation.messages.push({
      sender: "USER",
      content,
    });

    conversation.messages.push({
      sender: "ASSISTANT",
      content: answer,
      answerType,
      grounded,
      retrievalCount: sources.length,
      retrievalLimited: Boolean(retrievalLimited),
      sources: sources.map(({ id, type, kind, title, date, url, excerpt }) => ({
        id,
        type,
        kind,
        title,
        date: date || null,
        url: url || null,
        excerpt: excerpt || "",
      })),
    });

    if (
      conversation.title === "Health Assistant Chat" &&
      conversation.messages.length === 2
    ) {
      conversation.title = content.slice(0, 60);
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      message: "Message sent successfully.",
      userMessage: conversation.messages[conversation.messages.length - 2],
      assistantMessage: conversation.messages[conversation.messages.length - 1],
      sources,
      answerType,
      grounded,
      retrievalCount: sources.length,
      retrievalLimited: Boolean(retrievalLimited),
    });
  } catch (error) {
    console.error("Send chat message failed:", error.message);

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to process your message. Please try again.",
    });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    console.error("Delete conversation failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete conversation.",
    });
  }
};

module.exports = {
  getMyConversations,
  getLocalAIStatus,
  getPatientHealthOverview,
  ingestMedicalKnowledge,
  createConversation,
  getConversationById,
  sendMessage,
  deleteConversation,
};