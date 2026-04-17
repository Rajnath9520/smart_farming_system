const CropSchedule = require('../models/CropSchedule');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');


const getSchedules = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  const farmId = farm?._id?.toString() || '0';

  const schedules = await CropSchedule.find({ userId: req.user._id, farmId }).sort({ createdAt: -1 });
  sendSuccess(res, { schedules });
});

const getActive = asyncHandler(async (req, res) => {
  const farm = req.user.getActiveFarm();
  const farmId = farm?._id?.toString() || '0';

  const schedule = await CropSchedule.findOne({ userId: req.user._id, farmId, isActive: true });
  if (!schedule) return sendError(res, 'No active crop schedule', 404);

  const daysSinceSowing = Math.floor((new Date() - schedule.sowingDate) / (1000 * 60 * 60 * 24));
  const currentStage = schedule.stages.find(
    (s) => daysSinceSowing >= s.startDay && daysSinceSowing <= s.endDay
  );

  sendSuccess(res, { schedule, daysSinceSowing, currentStage });
});

const createSchedule = asyncHandler(async (req, res) => {
  const { cropType, soilType, sowingDate, area, customCropName, stages: customStages } = req.body;
  const farm = req.user.getActiveFarm();
  const farmId = farm?._id?.toString() || '0';

  await CropSchedule.updateMany({ userId: req.user._id, farmId }, { isActive: false });

  const stages = customStages || CropSchedule.getDefaultStages(cropType);

  const schedule = await CropSchedule.create({
    userId: req.user._id,
    farmId,
    cropType,
    customCropName,
    soilType,
    sowingDate: new Date(sowingDate),
    area,
    stages,
    isActive: true,
  });

  sendSuccess(res, { schedule }, 'Crop schedule created', 201);
});


const updateSchedule = asyncHandler(async (req, res) => {
  const { stages, soilType, notes, yieldPrediction, isActive, harvestedAt, cropHealthScore } = req.body;

  const schedule = await CropSchedule.findOne({ _id: req.params.id, userId: req.user._id });
  if (!schedule) return sendError(res, 'Schedule not found', 404);

  if (stages)           schedule.stages           = stages;
  if (soilType)         schedule.soilType         = soilType;
  if (notes)            schedule.notes            = notes;
  if (yieldPrediction)  schedule.yieldPrediction  = yieldPrediction;
  if (cropHealthScore)  schedule.cropHealthScore  = cropHealthScore;
  if (typeof isActive === 'boolean') schedule.isActive = isActive;
  if (harvestedAt)      schedule.harvestedAt      = new Date(harvestedAt);

  await schedule.save();
  sendSuccess(res, { schedule }, 'Schedule updated');
});


const deleteSchedule = asyncHandler(async (req, res) => {
  await CropSchedule.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  sendSuccess(res, {}, 'Schedule deleted');
});


const getDefaultStages = asyncHandler(async (req, res) => {
  const { cropType } = req.params;
  const stages = CropSchedule.getDefaultStages(cropType);
  sendSuccess(res, { cropType, stages });
});

module.exports = { getSchedules, getActive, createSchedule, updateSchedule, deleteSchedule, getDefaultStages };