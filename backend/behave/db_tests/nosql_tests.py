test_connections = [
        {
            "connection_query": "mongodb://root:rootpassword@mongodb:27017/organization?authSource=admin",  # Specify database in connection
            "tests":[
                {  
                    "collection": "employee",
                    "data_query": '{"department": "IT"}'
                },
                {  
                    "collection": "employee",
                    "data_query": '{"email": "adam@company.com"}'
                },
                {
                    "collection": "admin",
                    "data_query": """{"_id": {"$in": [1, 2, 3]}}"""
                },
                {
                    "collection": "hr",
                    "data_query": """{"email": "karen.hr@company.com"}"""
                },
                {
                    "collection": "hr",
                    "data_query": """{
                        "$lookup": {
                            "from": "admin",
                            "localField": "admin_id",
                            "foreignField": "_id",
                            "as": "admin_info"
                        }
                    }"""
                },
                {
                    "collection": "employee",
                    "data_query":  """{
                        "$lookup": {
                            "from": "hr",
                            "localField": "hr_id",
                            "foreignField": "_id",
                            "as": "hr_info"
                        }
                    }"""
                },
                {
                    "collection": "hr",
                    "data_query":  """{
                        "$lookup": {
                            "from": "admin",
                            "localField": "admin_id",
                            "foreignField": "_id",
                            "as": "admin_info"
                        }
                    }"""
                },
                {
                    "collection": "hr",
                    "data_query": """{
                        "$lookup": {
                            "from": "employee",
                            "localField": "_id",
                            "foreignField": "hr_id",
                            "as": "employees"
                        }
                    }"""
                }
            ]  
        }
    ]