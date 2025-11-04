module.exports = function (router) {
    var User = require('../models/user');
    var Task = require('../models/task');

    // GET /api/users - 获取用户列表（支持查询参数）
    router.route('/users')
        .get(function (req, res) {
            // 处理查询参数：where, sort, select, skip, limit, count
            var query = User.find();

            // where 参数
            if (req.query.where) {
                try {
                    var whereCondition = JSON.parse(req.query.where);
                    query = User.find(whereCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid where parameter",
                        data: {}
                    });
                }
            }

            // sort 参数
            if (req.query.sort) {
                try {
                    var sortCondition = JSON.parse(req.query.sort);
                    query = query.sort(sortCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid sort parameter",
                        data: {}
                    });
                }
            }

            // select 参数
            if (req.query.select) {
                try {
                    var selectCondition = JSON.parse(req.query.select);
                    query = query.select(selectCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid select parameter",
                        data: {}
                    });
                }
            }

            // skip 参数
            if (req.query.skip) {
                query = query.skip(parseInt(req.query.skip));
            }

            // limit 参数（用户无限制）
            if (req.query.limit) {
                query = query.limit(parseInt(req.query.limit));
            }

            // count 参数
            if (req.query.count === 'true') {
                query.countDocuments().then(function (count) {
                    res.status(200).json({
                        message: "OK",
                        data: count
                    });
                }).catch(function (err) {
                    res.status(500).json({
                        message: "Error counting users",
                        data: {}
                    });
                });
                return;
            }

            // 执行查询
            query.exec().then(function (users) {
                res.status(200).json({
                    message: "OK",
                    data: users
                });
            }).catch(function (err) {
                res.status(500).json({
                    message: "Error retrieving users",
                    data: {}
                });
            });
        })

        // POST /api/users - 创建新用户
        .post(function (req, res) {
            // 验证必需字段
            if (!req.body.name || !req.body.email) {
                return res.status(400).json({
                    message: "Name and email are required",
                    data: {}
                });
            }

            var user = new User({
                name: req.body.name,
                email: req.body.email,
                pendingTasks: req.body.pendingTasks || [],
                dateCreated: req.body.dateCreated || Date.now()
            });

            user.save().then(function (savedUser) {
                res.status(201).json({
                    message: "User created successfully",
                    data: savedUser
                });
            }).catch(function (err) {
                var errorMessage = "Error creating user";
                if (err.code === 11000) {
                    errorMessage = "Email already exists";
                }
                res.status(400).json({
                    message: errorMessage,
                    data: {}
                });
            });
        });

    // GET /api/users/:id - 获取特定用户
    router.route('/users/:id')
        .get(function (req, res) {
            var query = User.findById(req.params.id);

            // select 参数
            if (req.query.select) {
                try {
                    var selectCondition = JSON.parse(req.query.select);
                    query = query.select(selectCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid select parameter",
                        data: {}
                    });
                }
            }

            query.exec().then(function (user) {
                if (!user) {
                    return res.status(404).json({
                        message: "User not found",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: user
                });
            }).catch(function (err) {
                res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            });
        })

        // PUT /api/users/:id - 更新用户
        .put(function (req, res) {
            // 验证必需字段
            if (!req.body.name || !req.body.email) {
                return res.status(400).json({
                    message: "Name and email are required",
                    data: {}
                });
            }

            var newPendingTasks = req.body.pendingTasks || [];

            // 处理 pendingTasks - urlencoded 可能发送字符串或数组
            if (typeof newPendingTasks === 'string') {
                // 如果是字符串，尝试解析为数组
                try {
                    newPendingTasks = JSON.parse(newPendingTasks);
                } catch (e) {
                    // 如果不是 JSON，可能是逗号分隔的字符串
                    newPendingTasks = newPendingTasks.split(',').map(function (item) {
                        return item.trim();
                    }).filter(function (item) {
                        return item !== '';
                    });
                }
            }

            // 确保是数组
            if (!Array.isArray(newPendingTasks)) {
                newPendingTasks = [];
            }

            // 验证新 pendingTasks 中的所有任务是否存在
            if (newPendingTasks.length > 0) {
                Task.find({ _id: { $in: newPendingTasks } }).then(function (tasks) {
                    if (tasks.length !== newPendingTasks.length) {
                        return res.status(400).json({
                            message: "Some tasks in pendingTasks do not exist",
                            data: {}
                        });
                    }

                    // 更新用户
                    return User.findByIdAndUpdate(
                        req.params.id,
                        {
                            name: req.body.name,
                            email: req.body.email,
                            pendingTasks: newPendingTasks,
                            dateCreated: req.body.dateCreated || Date.now()
                        },
                        { new: true, runValidators: true }
                    );
                }).then(function (user) {
                    if (!user) {
                        return res.status(404).json({
                            message: "User not found",
                            data: {}
                        });
                    }
                    res.status(200).json({
                        message: "User updated successfully",
                        data: user
                    });
                }).catch(function (err) {
                    console.error('Error updating user:', err);
                    var errorMessage = "Error updating user";
                    if (err.code === 11000) {
                        errorMessage = "Email already exists";
                    }
                    res.status(400).json({
                        message: errorMessage + ": " + (err.message || ""),
                        data: {}
                    });
                });
            } else {
                // 如果没有 pendingTasks，直接更新
                User.findByIdAndUpdate(
                    req.params.id,
                    {
                        name: req.body.name,
                        email: req.body.email,
                        pendingTasks: [],
                        dateCreated: req.body.dateCreated || Date.now()
                    },
                    { new: true, runValidators: true }
                ).then(function (user) {
                    if (!user) {
                        return res.status(404).json({
                            message: "User not found",
                            data: {}
                        });
                    }
                    res.status(200).json({
                        message: "User updated successfully",
                        data: user
                    });
                }).catch(function (err) {
                    var errorMessage = "Error updating user";
                    if (err.code === 11000) {
                        errorMessage = "Email already exists";
                    }
                    res.status(400).json({
                        message: errorMessage,
                        data: {}
                    });
                });
            }
        })

        // DELETE /api/users/:id - 删除用户
        .delete(function (req, res) {
            User.findById(req.params.id).then(function (user) {
                if (!user) {
                    return res.status(404).json({
                        message: "User not found",
                        data: {}
                    });
                }

                var pendingTasksIds = user.pendingTasks || [];

                // 删除用户
                return User.findByIdAndDelete(req.params.id).then(function () {
                    // 取消分配该用户的所有待处理任务
                    if (pendingTasksIds.length > 0) {
                        Task.updateMany(
                            { _id: { $in: pendingTasksIds } },
                            {
                                assignedUser: "",
                                assignedUserName: "unassigned"
                            }
                        ).catch(function (err) {
                            // 忽略错误，继续返回成功
                        });
                    }

                    res.status(204).send();
                });
            }).catch(function (err) {
                res.status(404).json({
                    message: "User not found",
                    data: {}
                });
            });
        });

    return router;
}



