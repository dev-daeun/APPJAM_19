var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var multer = require('multer');
var multerS3 = require('multer-s3');
var router = express.Router();

var pool = mysql.createPool({
  host : db_config.host,
  port : db_config.port,
  user : db_config.user,
  password : db_config.password,
  database : db_config.database,
  connectionLimit : db_config.connectionLimit
});


//코디왕 제이슨어레이 전송. sql 문장에 에러있는데 못찾겠음
router.get('/', function(req, res, next) {
   var who = [];
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      var sql = 'SELECT codi, status, @Rank:=@Rank + 1 AS user_rank FROM(SELECT codi, sum(like_num) AS status FROM codi GROUP BY codi ORDER BY status DESC)Sub1 CROSS JOIN (SELECT @Rank:=0)Sub2 LIMIT 3';
      connection.query(sql, function(error, rows){
          if (error){
            console.log("Connection Error" + error);
            res.sendStatus(500);
          }
          else {
             var sql = 'select id as user_id, profile_nickname, profile_image from profile where profile_nickname = ?';
            connection.query(sql, rows[0].codi, function(error, result){
              if (error){
                console.log("Connection Error" + error);
                res.sendStatus(500);
              }
              else{
                who.push(result[0]);
                connection.query(sql, rows[1].codi, function(error, result){
                  if (error){
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                  }
                  else{
                    who.push(result[0]);
                    connection.query(sql, rows[2].codi, function(error, result){
                      if (error){
                        console.log("Connection Error" + error);
                        res.sendStatus(500);
                      }
                      else{
                        who.push(result[0]);
                        connection.query('select * from MD', function(error, MD_items){
                          if(error){
                            console.log("Connection Error" + error);
                            res.sendStatus(500);
                          }
                          else{
                            var sql = 'SELECT profile_nickname, profile_image, image1, image2, image3, image4, image5, image6, like_num from codi,profile where profile_nickname = codi COLLATE utf8_unicode_ci order by like_num desc limit 3';
                            connection.query(sql, function(error, week){
                            if(error){
                              console.log("Connection Error" + error);
                              res.sendStatus(500);
                            }
                            else {
                              var nickname = 'profile_nickname';
                              var image = 'profile_image';
                              var images = 'codi_images';
                              var codi_of_week = new Object([]);
                              for(var i = 0; i<3; i++){
                                var one = new Object({});
                                var image_array = new Object([]);
                                image_array.push(week[i].image1);
                                image_array.push(week[i].image2);
                                image_array.push(week[i].image3);
                                image_array.push(week[i].image4);
                                image_array.push(week[i].image5);
                                image_array.push(week[i].image6);
                                one[nickname] = week[i].profile_nickname;
                                one[image] = week[i].profile_image;
                                one[images] = image_array;
                                codi_of_week.push(one);
                              }

                              res.status(200).send({kings : who, MD_items : MD_items, week : codi_of_week});
                                connection.release();
                            }
                          });
                          }
                        });
                      } // async
                    });
                  } // async
                });
              } // async
            });
    }
  });
}
});
});
module.exports = router;
