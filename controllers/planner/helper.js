const querystring = require("querystring");
const api = require("../../api");

const getCurrentSchoolYearId = async (req, currentSchoolYear) => {
  // We have to query the schoolYearId based on the name. Not perfect, but no other way currently :/
  const firstSchoolYearPart = `${new Date(
    currentSchoolYear.utcStartDate
  ).getUTCFullYear()}`;
  const secondSchoolYearPart = `${new Date(
    currentSchoolYear.utcEndDate
  ).getUTCFullYear()}`.slice(-2);
  const schoolYearName = [firstSchoolYearPart, secondSchoolYearPart].join("/");
  const schoolYearData = await api(req).get("/years", {
    qs: {
      name: schoolYearName
    }
  });

  return schoolYearData.data[0]._id;
};

const getUTCDate = date => {
  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    0
  );
};
const transfromISODateToUTC = date => getUTCDate(new Date(Date.parse(date)));

const getFederalState = async (req, schoolId) => {
  const schoolData = await api(req).get("/schools/" + schoolId, {
    qs: {
      $populate: ["federalState"]
    }
  });
  return schoolData.federalState.abbreviation;
};

const checkForSommerHoliday = holiday =>
  holiday.name.toLowerCase() === "sommerferien";

const getFirstSommerHolidays = holidays => holidays.find(checkForSommerHoliday);

const capitalizeFirstLetter = string =>
  string.charAt(0).toUpperCase() + string.slice(1);
const getHolidays = async (req, { year, stateCode }) => {
  const queryParams = querystring.stringify({ year, stateCode });
  const url = `/holidays?${queryParams}`;
  const holidays = await api(req).get(url);

  return holidays.map(holiday => ({
    name: capitalizeFirstLetter(holiday.name),
    color: "#FBFFCF",
    utcStartDate: transfromISODateToUTC(holiday.start),
    utcEndDate: transfromISODateToUTC(holiday.end),
    year: holiday.year,
    stateCode: holiday.stateCode
  }));
};

module.exports = {
  getUTCDate,
  transfromISODateToUTC,
  getFederalState,
  getHolidays,
  checkForSommerHoliday,
  getFirstSommerHolidays,
  getCurrentSchoolYearId
};