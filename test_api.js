// API 测试脚本
// 使用方法: node test_api.js

var http = require('http');

var baseURL = 'localhost';
var port = 3000;

// 辅助函数：发送 HTTP 请求
function makeRequest(method, path, data, callback) {
    var options = {
        hostname: baseURL,
        port: port,
        path: path,
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var req = http.request(options, function (res) {
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            try {
                var json = JSON.parse(body);
                callback(null, json, res.statusCode);
            } catch (e) {
                callback(null, body, res.statusCode);
            }
        });
    });

    req.on('error', function (e) {
        console.error('请求错误:', e.message);
        console.error('请确保服务器正在运行: npm start');
        callback(e);
    });

    req.setTimeout(5000, function () {
        req.destroy();
        callback(new Error('请求超时'));
    });

    if (data) {
        req.write(JSON.stringify(data));
    }
    req.end();
}

// 测试函数
function runTests() {
    console.log('开始测试 API...\n');
    console.log('确保服务器正在运行在 http://localhost:3000\n');

    var userId = null;
    var taskId = null;

    // 测试1: 创建用户
    console.log('1. 测试创建用户...');
    makeRequest('POST', '/api/users', {
        name: '测试用户',
        email: 'test@example.com'
    }, function (err, data, statusCode) {
        if (err) {
            console.error('错误:', err.message);
            return;
        }
        if (!data) {
            console.error('没有收到响应数据');
            return;
        }
        if (statusCode === 201 && data.message === 'User created successfully') {
            console.log('✓ 创建用户成功');
            userId = data.data._id;
            console.log('  用户ID:', userId);

            // 测试2: 获取用户
            console.log('\n2. 测试获取用户...');
            makeRequest('GET', '/api/users/' + userId, null, function (err, data, statusCode) {
                if (err) {
                    console.error('错误:', err.message);
                    return;
                }
                if (statusCode === 200 && data.message === 'OK') {
                    console.log('✓ 获取用户成功');

                    // 测试3: 创建任务
                    console.log('\n3. 测试创建任务...');
                    var deadline = new Date('2025-12-31T23:59:59Z').toISOString();
                    makeRequest('POST', '/api/tasks', {
                        name: '测试任务',
                        deadline: deadline,
                        description: '这是一个测试任务',
                        assignedUser: userId,
                        assignedUserName: '测试用户'
                    }, function (err, data, statusCode) {
                        if (err) {
                            console.error('错误:', err.message);
                            return;
                        }
                        if (statusCode === 201 && data.message === 'Task created successfully') {
                            console.log('✓ 创建任务成功');
                            taskId = data.data._id;
                            console.log('  任务ID:', taskId);

                            // 测试4: 验证双向引用 - 检查用户的 pendingTasks
                            console.log('\n4. 测试双向引用 - 检查用户 pendingTasks...');
                            makeRequest('GET', '/api/users/' + userId, null, function (err, data, statusCode) {
                                if (err) {
                                    console.error('错误:', err.message);
                                    return;
                                }
                                if (data.data.pendingTasks && data.data.pendingTasks.indexOf(taskId) !== -1) {
                                    console.log('✓ 双向引用正确 - 任务已添加到用户的 pendingTasks');
                                } else {
                                    console.log('✗ 双向引用错误 - 任务未添加到用户的 pendingTasks');
                                    console.log('  用户 pendingTasks:', data.data.pendingTasks);
                                    console.log('  任务ID:', taskId);
                                }

                                // 测试5: 更新任务
                                console.log('\n5. 测试更新任务...');
                                makeRequest('PUT', '/api/tasks/' + taskId, {
                                    name: '更新后的任务',
                                    deadline: deadline,
                                    completed: true
                                }, function (err, data, statusCode) {
                                    if (err) {
                                        console.error('错误:', err.message);
                                        return;
                                    }
                                    if (statusCode === 200) {
                                        console.log('✓ 更新任务成功');

                                        // 测试6: 删除任务
                                        console.log('\n6. 测试删除任务...');
                                        makeRequest('DELETE', '/api/tasks/' + taskId, null, function (err, data, statusCode) {
                                            if (err) {
                                                console.error('错误:', err.message);
                                                return;
                                            }
                                            if (statusCode === 204) {
                                                console.log('✓ 删除任务成功');

                                                // 测试7: 验证删除任务后用户的 pendingTasks
                                                console.log('\n7. 验证删除任务后用户的 pendingTasks...');
                                                makeRequest('GET', '/api/users/' + userId, null, function (err, data, statusCode) {
                                                    if (err) {
                                                        console.error('错误:', err.message);
                                                        return;
                                                    }
                                                    if (!data.data.pendingTasks || data.data.pendingTasks.indexOf(taskId) === -1) {
                                                        console.log('✓ 双向引用正确 - 任务已从用户的 pendingTasks 中移除');
                                                    } else {
                                                        console.log('✗ 双向引用错误 - 任务仍在用户的 pendingTasks 中');
                                                    }

                                                    // 测试8: 删除用户
                                                    console.log('\n8. 测试删除用户...');
                                                    makeRequest('DELETE', '/api/users/' + userId, null, function (err, data, statusCode) {
                                                        if (err) {
                                                            console.error('错误:', err.message);
                                                            return;
                                                        }
                                                        if (statusCode === 204) {
                                                            console.log('✓ 删除用户成功');
                                                            console.log('\n所有测试完成！');
                                                        } else {
                                                            console.log('✗ 删除用户失败，状态码:', statusCode);
                                                        }
                                                    });
                                                });
                                            } else {
                                                console.log('✗ 删除任务失败，状态码:', statusCode);
                                                if (data) {
                                                    console.log('  响应:', JSON.stringify(data, null, 2));
                                                }
                                            }
                                        });
                                    } else {
                                        console.log('✗ 更新任务失败，状态码:', statusCode);
                                        if (data) {
                                            console.log('  响应:', JSON.stringify(data, null, 2));
                                        }
                                    }
                                });
                            });
                        } else {
                            console.log('✗ 创建任务失败，状态码:', statusCode);
                            if (data) {
                                console.log('  响应:', JSON.stringify(data, null, 2));
                            }
                        }
                    });
                } else {
                    console.log('✗ 获取用户失败，状态码:', statusCode);
                    if (data) {
                        console.log('  响应:', JSON.stringify(data, null, 2));
                    }
                }
            });
        } else {
            console.log('✗ 创建用户失败，状态码:', statusCode);
            if (data) {
                console.log('  响应:', JSON.stringify(data, null, 2));
            } else {
                console.log('  没有收到响应数据');
            }
        }
    });
}

// 运行测试
runTests();
