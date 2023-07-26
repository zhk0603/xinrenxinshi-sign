var CryptoJS = require("crypto-js");
const axios = require("axios");
const qs = require("qs");
const utils = require("./utils");
const constant = require("./constant");

function generateSignature(data = []) {
  data.reverse();
  let str = "";
  data.forEach((x) => {
    str += Object.keys(x).join("") + "=" + Object.values(x).join("") + "&";
  });

  str = str.substring(0, str.length - 1);
  var bytes = CryptoJS.HmacSHA1(str, generateKey(constant.ajParam));
  return CryptoJS.enc.Base64.stringify(bytes);
}

function generateKey(e, t) {
  var n = "O*1&d!-1#";
  if (t) {
    Object.values(e).map(function (e) {
      e.indexOf("N") >= 0 && (n = e);
    });
  } else {
    Object.values(e).map(function (e) {
      e.indexOf("K") >= 0 && (n = e);
    });
  }
  return n;
}

function encodePwd(t, e) {
  e = e || "qjydxone";
  var n,
    r = [],
    o = 0,
    i = 0,
    a = "";
  for (o = 0; o < 256; o++) r[o] = o;
  for (o = 0; o < 256; o++)
    (i = (i + r[o] + e.charCodeAt(o % e.length)) % 256),
      (n = r[o]),
      (r[o] = r[i]),
      (r[i] = n);
  (o = 0), (i = 0);
  for (var c = 0; c < t.length; c++)
    (o = (o + 1) % 256),
      (i = (i + r[o]) % 256),
      (n = r[o]),
      (r[o] = r[i]),
      (r[i] = n),
      (a += String.fromCharCode(t.charCodeAt(c) ^ r[(r[o] + r[i]) % 256]));
  for (var u = "", s = 0; s < a.length; s++) {
    var f = a.charCodeAt(s);
    "" == u
      ? (u = f >= 16 ? f.toString(16) : "0" + f.toString(16))
      : (u += f >= 16 ? f.toString(16) : "0" + f.toString(16));
  }
  return u;
}

async function ajax_get_login_info() {
  const resp = await axios({
    url: "https://s.xinrenxinshi.com/account-center/service/sso/ajax-get-login-info",
    method: "post",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "User-Agent": constant.userAgent,
    },
    data: qs.stringify({
      fromUrl: "",
      fromType: "",
      appId: "app-admin",
    }),
  });

  return resp;
}

async function ajax_password_login(username, password) {
  const loginInfoResp = await ajax_get_login_info();
  const cookie = loginInfoResp.headers.get("Set-Cookie");

  const loginInfo = loginInfoResp.data.data;

  const loginData = {
    verifyMode: 0,
    accountName: username,
    password: encodePwd(password, loginInfo.passwordKey),
    passwordKey: loginInfo.passwordKey,
    fromUrl: "",
    innerVerifyKey: "",
  };

  const resp = await axios({
    url: "https://s.xinrenxinshi.com/account-center/service/sso/ajax-password-login",
    method: "post",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Cookie: cookie.join(";"),
      Referer: "https://s.xinrenxinshi.com/sso/login",
      Origin: "https://s.xinrenxinshi.com",
      "User-Agent": constant.userAgent,
    },
    data: qs.stringify(loginData),
  });
  if (!resp.data.status) {
    throw new Error(resp.data.message);
  }
  return resp.data.data;
}

async function ajax_get_current_shift_info(ssotoken) {
  const resp = await axios({
    url: "https://e.xinrenxinshi.com/attendance/ajax-get-current-shift-info",
    method: "get",
    headers: {
      "User-Agent": constant.userAgent,
      Referer: "https://e.xinrenxinshi.com/attendance/sign-in",
      Cookie: `QJYDSID=${ssotoken}; WAVESSID=${ssotoken}`,
    },
  });

  return resp.data.data;
}

async function ajax_sign(shiftInfo, ssotoken) {
  // 打卡点， 从 shiftInfo.clockPlanShiftModel.attendancePlaces 里面获取
  const place = shiftInfo.clockPlanShiftModel.attendancePlaces[1];
  let coordinate = {
    longitude: place.longitudeReal,
    latitude: place.latitudeReal,
    accuracy: 10,
  };
  console.log("coordinate", coordinate);
  coordinate = Object.assign(
    coordinate,
    utils.generateNewCoordinate(
      coordinate.longitude,
      coordinate.latitude,
      0.001
    )
  );

  const model = shiftInfo.attendanceShiftInfoModel[0];
  const clockTime = model.clockTimeRangeList[0];

  const earliestCheckInTime = Date.parse(
    `${model.date} ${clockTime.onWork.earliestCheckInTime}`
  );
  const latestCheckInTime = Date.parse(
    `${model.date} ${clockTime.onWork.latestCheckInTime}`
  );

  let isOnWork = false;
  const nowTimestamp = new Date().getTime();
  if (
    nowTimestamp >= earliestCheckInTime &&
    nowTimestamp <= latestCheckInTime &&
    !clockTime.onWork.signInTime
  ) {
    isOnWork = true;
  }
  const realTime = isOnWork
    ? clockTime.onWork.realOnWorkTime
    : clockTime.offWork.realOffWorkTime;

  const postData = {
    longitude: coordinate.longitude,
    latitude: coordinate.latitude,
    accuracy: coordinate.accuracy,
    timestamp: new Date().getTime(),
    signature: undefined,
    macAddr: "",
    clockSettingId: model.clockSettingId,
    date: model.date,
    clockTimeRangeId: clockTime.clockTimeRangeId,
    isOnWork: isOnWork ? "1" : "2",
    realTime: realTime,
  };

  const signatureData = [
    {
      longitude: postData.longitude,
    },
    {
      latitude: postData.latitude,
    },
    {
      accuracy: postData.accuracy,
    },
    {
      timestamp: postData.timestamp,
    },
    {
      macAddr: postData.macAddr,
    },
  ];

  const signature = generateSignature(signatureData);
  postData.signature = signature;

  console.log("postData", postData);

  const resp = await axios({
    url: "https://e.xinrenxinshi.com/attendance/ajax-sign",
    method: "post",
    headers: {
      "User-Agent": constant.userAgent,
      Referer: "https://e.xinrenxinshi.com/attendance/sign-in",
      Cookie: `QJYDSID=${ssotoken}; WAVESSID=${ssotoken}`,
    },
    data: postData,
  });

  console.log("sign result ==> ", resp.data);
}

async function doSign() {
  const loginInfo = await ajax_password_login("YOU_USERNAME", "YOU_PWD");
  const shiftInfo = await ajax_get_current_shift_info(loginInfo.ssotoken);
  await ajax_sign(shiftInfo, loginInfo.ssotoken);
}
doSign();
