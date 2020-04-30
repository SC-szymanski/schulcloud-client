/**
 * First step in uploading any files: Requesting a signed url which
 * allows the client to upload the file to S3
 *
 * @param {File} file The file object taken from an input[type=file]s FileList
 * @param {ObjectID} parent Optional id of a parent file object (such as a folder)
 * @returns {jqXHR} An jqXHR that can also be used like a promise
 */
export function requestUploadUrl(file, parent) {
	// get signed url before processing the file
	return $.post('/files/file', {
		parent,
		type: file.type,
		filename: file.name,
	});
}

/**
 * Actually upload the file to S3. Does not include progress tracking or such.
 *
 * @param {File} file The file object taken from an input[type=file]s FileList
 * @param {Object with url and header} signedUrl Response from `requestUploadUrl`
 * @returns {jqXHR} An jqXHR that can also be used like a promise
 */
export function uploadFile(file, signedUrl) {
	return $.ajax({
		url: signedUrl.url,
		headers: signedUrl.header,
		type: 'PUT',
		data: file,
		dataType: 'text',
		cache: false,
		contentType: file.type,
		processData: false,
	});
}

/**
 * Create the backend entry for the file after it was successfully uploaded to S3
 *
 * @param {Object} params The params to send to the server to create a file object
 * @returns {jqXHR} An jqXHR that can also be used like a promise
 */
export function createFileModel(params) {
	return $.post('/files/fileModel', params);
}

/**
 * Associate a new file model with a submission, by updating the submission.
 * Then give read-access to all team-members of that submission.
 *
 * @param {Object} options
 * @param {ObjectID} options.submissionId The id of the submission that the file will be associated with
 * @param {ObjectId} options.fileId The id of the new file model. A result of `createFileModel`.signedUrl
 * @param {enum} options.associationType The type of file association for the new file. One of ['files', 'grade-files']
 * @param {[ObjectId]} options.teamMembers A list of ids of users that should get read access to the file
 * @returns {Promise}
 */
export function associateFileWithSubmission({
	submissionId,
	fileId,
	associationType = 'files',
	teamMembers,
}) {
	return $.post(
		`/homework/submit/${submissionId}/${associationType}`,
		{ fileId, teamMembers },
	).then(() => $.post(
		`/homework/submit/${submissionId}/files/${fileId}/permissions`,
		{ teamMembers },
	));
}

/**
 * Do the whole upload flow for a file
 *
 * @param {Object} options
 * @param {File} options.file The file object taken from an input[type=file]s FileList
 * @param {string} options.owner An optional owner, if the signed in users should not be the owner of the new file
 * @param {ObjectID} options.parent Optional id of a parent file object (such as a folder)
 * @param {ObjectID} options.submissionId The id of the submission that the file will be associated with
 * @param {enum} options.associationType The type of file association for the new file. One of ['files', 'grade-files']
 * @param {[ObjectId]} options.teamMembers A list of ids of users that should get read access to the file
 * @returns {Promise}
 */
export async function uploadSubmissionFile({
	file,
	owner,
	parent,
	submissionId,
	associationType,
	teamMembers,
}) {
	const { signedUrl } = await requestUploadUrl(file, parent);
	await uploadFile(file, signedUrl);

	const fileModelParams = {
		name: file.name,
		owner,
		type: file.type,
		size: file.size,
		storageFileName: signedUrl.header['x-amz-meta-flat-name'],
		thumbnail: signedUrl.header['x-amz-meta-thumbnail'],
		parent: parent || undefined, // JSON.stringify will remove the key
	};

	const fileModel = await createFileModel(fileModelParams);
	await associateFileWithSubmission({
		fileId: fileModel._id,
		submissionId,
		associationType,
		teamMembers,
	});
}
