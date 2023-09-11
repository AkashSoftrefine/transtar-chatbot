const express = require("express");
require("dotenv").config();
const db = require("./db");

const PORT = process.env.PORT || 3000;

const locations = {
  "Federal Territory of Kuala Lumpur": "Kuala Lumpur",
};

// SERVER
const app = express();

app.listen(PORT, () => {
  console.log(`Server is up and running at ${PORT}`);
});

// MIDDLEWARES
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ROUTES
const handleDefault = () => {
  return "This is your default response from the webhook.";
};

const getOneWayTrips = (response, callback) => {
  const outputContext = response?.outputContexts?.[0];
  const pickupLocation =
    locations[outputContext?.parameters?.pickup_location] ||
    outputContext?.parameters?.pickup_location;
  const dropLocation =
    locations[outputContext?.parameters?.drop_location] ||
    outputContext?.parameters?.drop_location;
  const journeyDate = outputContext?.parameters?.journey_date;
  const date = journeyDate.split("T")[0];

  db.query(
    `
    SELECT startdate, enddate, pick_location.name AS pickup_location, drop_location.name AS drop_location 
    FROM trips
    LEFT JOIN locations AS pick_location ON pick_location.id = trips.pick_location_id
    LEFT JOIN locations AS drop_location ON drop_location.id = trips.drop_location_id
    WHERE trips.status = '1' 
    AND trips.deleted_at IS NULL
    AND trips.startdate >= CURDATE()
    AND LOWER(pick_location.name) = '${pickupLocation?.toLowerCase()}'
    AND LOWER(drop_location.name) = '${dropLocation?.toLowerCase()}'
    AND DATE_FORMAT(trips.startdate, '%Y-%m-%d') = '${date}'
    `,

    (error, results) => {
      if (error) {
        console.error("Error querying the database:", error);
        return callback("Internal Server Error");
      }

      if (results?.length > 0) {
        const trips = [];
        results.map((trip) => {
          trips.push({
            type: "description",
            title: `${trip?.pickup_location} - ${trip?.drop_location}`,
            text: [
              `
            Start Date: ${new Date(trip?.startdate).toLocaleString()} - 
            End Date: ${new Date(trip?.enddate).toLocaleString()}
            `,
            ],
          });
        });

        const availableTrips = [
          {
            payload: {
              richContent: [trips],
            },
          },
        ];

        const response = {
          fulfillmentMessages: availableTrips,
        };

        callback(response);
      } else {
        const response = {
          fulfillmentText: `Sorry, No trips available from ${pickupLocation} to ${dropLocation} on ${new Date(
            journeyDate
          ).toLocaleString()}.`,
        };
        callback(response);
      }
    }
  );
};

const getTripsList = async (pickupLocation, dropLocation, date) => {
  return new Promise((resolve, reject) => {
    db.query(
      `
      SELECT startdate, enddate, pick_location.name AS pickup_location, drop_location.name AS drop_location
      FROM trips
      LEFT JOIN locations AS pick_location ON pick_location.id = trips.pick_location_id
      LEFT JOIN locations AS drop_location ON drop_location.id = trips.drop_location_id
      WHERE trips.status = '1'
      AND trips.deleted_at IS NULL
      AND trips.startdate >= CURDATE()
      AND LOWER(pick_location.name) = '${pickupLocation?.toLowerCase()}'
      AND LOWER(drop_location.name) = '${dropLocation?.toLowerCase()}'
      AND DATE_FORMAT(trips.startdate, '%Y-%m-%d') = '${date}'
    `,
      (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      }
    );
  });
};

const getReturnTripsList = async (pickupLocation, dropLocation, returnDate) => {
  return new Promise((resolve, reject) => {
    db.query(
      `
      SELECT startdate, enddate, pick_location.name AS pickup_location, drop_location.name AS drop_location
      FROM trips
      LEFT JOIN locations AS pick_location ON pick_location.id = trips.pick_location_id
      LEFT JOIN locations AS drop_location ON drop_location.id = trips.drop_location_id
      WHERE trips.status = '1'
      AND trips.deleted_at IS NULL
      AND trips.startdate >= CURDATE()
      AND LOWER(pick_location.name) = '${dropLocation?.toLowerCase()}'
      AND LOWER(drop_location.name) = '${pickupLocation?.toLowerCase()}'
      AND DATE_FORMAT(trips.startdate, '%Y-%m-%d') = '${returnDate}'
    `,
      (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      }
    );
  });
};

const getReturnTrips = async (response, callback) => {
  const outputContext = response?.outputContexts?.[0];
  const pickupLocation =
    locations[outputContext?.parameters?.pickup_location] ||
    outputContext?.parameters?.pickup_location;
  const dropLocation =
    locations[outputContext?.parameters?.drop_location] ||
    outputContext?.parameters?.drop_location;
  const journeyDate = outputContext?.parameters?.journey_date;
  const journeyReturnDate = outputContext?.parameters?.return_journey_date;
  const date = journeyDate?.split("T")[0];
  const returnDate = journeyReturnDate?.split("T")[0];

  try {
    const tripList = await getTripsList(pickupLocation, dropLocation, date);
    const returnTripList = await getReturnTripsList(
      pickupLocation,
      dropLocation,
      returnDate
    );

    if (tripList?.length > 0 && returnTripList?.length > 0) {
      const availableTrips = [
        {
          payload: {
            richContent: [
              [
                {
                  type: "description",
                  title: `${pickupLocation} - ${dropLocation}`,
                  text: [
                    `
              Journey Date: ${new Date(date).toLocaleString()} - 
              Return Date: ${new Date(returnDate).toLocaleString()}
              `,
                  ],
                },
              ],
            ],
          },
        },
      ];

      const response = {
        fulfillmentMessages: availableTrips,
      };

      callback(response);
    } else {
      const response = {
        fulfillmentText: `Sorry, there are no return trips packages available from ${pickupLocation} to ${dropLocation}.`,
      };

      callback(response);
    }
  } catch (error) {
    console.error("Error querying the database:", error);
    return callback("Internal Server Error");
  }
};

const getTourPackages = (response, callback) => {
  const outputContext = response?.outputContexts?.[0];
  const countryName = outputContext?.parameters?.tour_country;

  db.query(
    `
    SELECT tour_name, start_date, end_date 
    FROM tour 
    LEFT JOIN country ON country.id = tour.country_id
    WHERE tour.status = 'active' 
    AND tour.start_date >= CURDATE()
    AND tour.deleted_at IS NULL
    AND LOWER(country.name) = '${countryName?.toLowerCase()}'
    `,

    (error, results) => {
      if (error) {
        console.error("Error querying the database:", error);
        return callback("Internal Server Error");
      }

      if (results?.length > 0) {
        const tours = [];
        results.map((tour) => {
          tours.push({
            type: "list",
            title: tour?.tour_name,
            subtitle: `${tour?.start_date} - ${tour?.end_date}`,
          });
        });

        const tourPackages = [
          {
            payload: {
              richContent: [tours],
            },
          },
        ];

        const response = {
          fulfillmentMessages: tourPackages,
        };

        callback(response);
      } else {
        const response = {
          fulfillmentText: `Sorry, there are no tour packages available for ${countryName}.`,
        };
        callback(response);
      }
    }
  );
};

const getAttractionPackages = (response, callback) => {
  const outputContext = response?.outputContexts?.[0];
  const countryName = outputContext?.parameters?.attraction_country;

  db.query(
    `
    SELECT attraction_name, start_date
    FROM attractions 
    LEFT JOIN country ON country.id = attractions.country_id
    WHERE attractions.status = 'active' 
    AND attractions.start_date >= CURDATE()
    AND attractions.deleted_at IS NULL
    AND LOWER(country.name) = '${countryName?.toLowerCase()}'
    `,

    (error, results) => {
      if (error) {
        console.error("Error querying the database:", error);
        return callback("Internal Server Error");
      }

      if (results?.length > 0) {
        const attractions = [];
        results.map((attraction) => {
          attractions.push({
            type: "list",
            title: attraction?.attraction_name,
            subtitle: `${attraction?.start_date}`,
          });
        });

        const attractionPackages = [
          {
            payload: {
              richContent: [attractions],
            },
          },
        ];

        const response = {
          fulfillmentMessages: attractionPackages,
        };

        callback(response);
      } else {
        const response = {
          fulfillmentText: `Sorry, there are no attraction packages available for ${countryName}.`,
        };
        callback(response);
      }
    }
  );
};

const generateText = (response, callback) => {
  const fallbackResponse = [
    {
      payload: {
        richContent: [
          [
            {
              type: "description",
              title:
                "Oops! It seems I didn't quite understand your request. No worries, though! If you have any questions or need assistance with anything related to your travel plans, feel free to get in touch with us.",
              text: [
                "Address: 601 Macpherson Road #01-08A, Grantral Mall @ Macpherson, Singapore 368242",
                "Email: enquiry@transtar.travel",
                "Phone: +65 6295 9009",
                "Our friendly team is here to assist you with any inquiries you may have. Don't hesitate to reach out, and we'll be happy to help you! 😊",
              ],
            },
          ],
        ],
      },
    },
  ];
  const res = {
    fulfillmentMessages: fallbackResponse,
  };
  callback(res);
};

const actionFunctions = {
  "confirm.onewaytrip": getOneWayTrips,
  "confirm.returntrip": getReturnTrips,
  "get.tourcountry": getTourPackages,
  "get.attractioncountry": getAttractionPackages,
  "input.unknown": generateText,
};

app.post("/dialogflow", async (req, res) => {
  try {
    const queryResult = req.body.queryResult;
    const action = queryResult?.action;

    const actionFunction = actionFunctions[action] || handleDefault;

    actionFunction(queryResult, (response) => {
      res.json(response);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
