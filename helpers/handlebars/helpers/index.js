/* eslint-disable no-console */
const permissionsHelper = require('../../permissions');
const moment = require('moment');
moment.locale('de');

module.exports = {
    pagination: require('./pagination'),
    ifArray: (item, options) => {
        if(Array.isArray(item)) {
            return options.fn(item);
        } else {
            return options.inverse(item);
        }
    },
    truncate: (text = '', {length = 140} = {}) => {
        if (text.length <= length) {
            return text;
        }
        const subString = text.substr(0, length-1);
        return subString.substr(0, subString.lastIndexOf(' ')) + "...";
    },
    ifeq: (a, b, opts) => {
        if (a == b) {
            return opts.fn(this);
        } else {
            return opts.inverse(this);
        }
    },
    userHasPermission: (permission, opts) => {
        if (permissionsHelper.userHasPermission(opts.data.local.currentUser, permission)) {
            return opts.fn(this);
        } else {
            return opts.inverse(this);
        }
    },
    ifvalue: (conditional, options) => {
        if (options.hash.value === conditional) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    },
    timeFromNow: (date, opts) => {
        return moment(date).fromNow();
    },
    log: (data) => {
        console.log(data);
    }
};